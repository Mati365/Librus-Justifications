/** 
 * Konfiguracja wtyczki 
 * PROTIP: 0 to zwolnienie, a 1 usprawiedliwienie
 */
var getParent = function() {
	var regex = new RegExp('\\)(\\D*) (\\D*)\\s\\('),
		vals  = regex.exec($('div#user-section').text());
	return vals[1]+' '+vals[2];
};
/** Czy assoc jest pusty? */
var isEmpty = function(map) {
   for(var key in map)
      if (map.hasOwnProperty(key))
         return false;
   return true;
};
var config = {
	info   : 	{
		name 			: 	'Mateusza Bagińskiego', 	/** DO ZMIANY !!!!!!!!!!!!! */
		male 			: 	true, 						/** DO ZMIANY !!!!!!!!!!!!! */
		parent 			: 	getParent(),
		msg_address 	: 	'https://dziennik.librus.pl/wiadomosci/2/5'
	},
	days   : 	{
		'pon' 	: 	'Poniedziałek',
		'wt' 	: 	'Wtorek',
		'śr' 	: 	'Środa',
		'czw'	: 	'Czwartek',
		'pt' 	: 	'Piątek'
	},
	hours 	: 	[
		'1-ej', '2-iej', '3-ciej', 
		'4-tej', '5-tej', '6-tej', 
		'7-ej', '8-mej', '9-ej'
	],
	messages: 	{
		/** Szablon */
		TYPES 		: [ 
			'zwolnić', 
			'usprawiedliwić' 
		],
		HEADER 		: 'Witam!\nProszę <%= type %> <%= male?"mojego syna":"moją córkę" %> <%= name %> ',
		BODY 		: {
			0 	: 	'z <%= body %> godziny lekcyjnej dnia <%= date %>',
			1 	: 	'nieobecnego na zajęciach lekcyjnych w <%= count>1?"dniach":"dniu" %> <%= body %>'
		},
		/** Powody usprawiedliwień */
		REASON 		: [
			'choroby', 
			'złego samopoczucia',
			'gorączki',
			'bólu brzucha',
			'bólu głowy',
			'grypy jelitowej',
			'grypy',
			'przeziębienia',
			'zapalenia pęcherza',
			'biegunku',
			// 'bólu dupy',
			'wizyty u lekarza', 
			'wizyty u dentysty',
			'wizyty u stomatologa',

			'wyjazdu rodzinnego', 
			'spraw rodzinnych',
		],
		FOOTER 		: '\n<%= parent %>.'
	}
};

/** Kolejka usprawiedliwień */
var Queue = function() {
	this.queue = {};

	this.register = function(date) { this.queue[date.date] = date; };
	this.delete   = function(date) { delete this.queue[date.date]; };
};

/** 
 * Rozdzielenie dni i pojedynczych godzin dla zwolnień
 * jeśli są max 3 następujące po sobie godziny to uznaje
 * jako zwolnienie, jeśli nie to usprawiedliwia cały dzień
 */
Queue.prototype.dialog = function() {
	if(isEmpty(this.queue))
		return;
	/** Generowanie */
	var self = this,
		days = [ [],[] ],
		log  = '';
	_.each(this.queue, function(day, date) {
		days[+(day.hours>3)].push(day);
	});
	/**
	 * Rozbijanie wiadomości, jeśli jest to zwolnienie
	 * to rozbijane na wiele wiadomości, jesli nieobecność
	 * w całym dniu to łączone w jedną wiadomość
	 */
	var to_send    = [],
		regMessage = function(day, type) {
			to_send.push(self.genMessage(day, type));
		};
	if(days[1].length)
		regMessage(days[1], 1);
	_.each(days[0], function(day) {
		regMessage(day, 0);
	});
	/** Potwierdzenie usprawiedliwienia */
	chrome.runtime.sendMessage({ 
		queue : to_send 
	});
};
/** 
 * Generowanie usprawiedliwienia, jeśli jest to
 * nieobecność całodniowa to days jest [], jeśli
 * zwolnieniem days jest wartością
 */
Queue.prototype.genMessage = function(days, type) {
	var t    	 = config.messages,
	    i 	 	 = config.info,
	    title  	 = !type?'Zwolnienie':'Usprawiedliwienie ',
		content  = '', 
		args 	 = {},
		/** Dodawanie bloku do usprawiedliwienia */
		add  	 = function(_str, _args) { content += _str; args = $.extend(args, _args); };
	
	/** Tworzenie wiadomości */
	var body 	  = '', 
		body_opts = {},
		implode   = function(array, callback, opt, data_callback) {
			var data = '';
			_.each(array, function(obj, key) {
				data += callback(obj)+(key+1<array.length?', ':'');
			});
			body 	  += data;
			body_opts = $.extend(body_opts, opt);
			if(typeof data_callback !== 'undefined')
				data_callback(data);
		};
	/** W zależności od typu */
	implode.apply(this, !type?
				[
					days.absence, 
					function(hours) { return config.hours[hours]; }, 
					{ 'date' : days.fullDate() }
				]:
				[
					days, 
					function(day) { return day.fullDate(); }, 
					{ 'count': days.length }, 
					function(date) { title += date; }
				]);

	/** Nagłówek*/
	add(t.HEADER, {
		type 	: 	t.TYPES[type || 0],
		male 	: 	i.male,
		name 	: 	i.name
	});
	/** Powód */
	add(t.BODY[type], $.extend(body_opts, { body : body }));
	content += ' z powodu '+t.REASON[Math.floor(Math.random()*t.REASON.length)]+'.';
	/** Stopka */
	add(t.FOOTER, { parent : i.parent });

	return {
		title 	: title,
		content : _.template(content)(args)
	};
};
/**
 * Dzień, w którym ma przynajmniej
 * jedną nieusprawiedliwioną godzinę
 */
var Day = function(date, cols) {
	this.date 	=	date[1];
	this.day 	=	config.days[date[2]];
	this.absence= 	[];
	this.hours  = 	0; 	// ilość nieobecności

	/** Pobieranie całej daty */
	this.fullDate = function() {
		return this.date+'('+this.day+')';
	};

	/** Tworzenie listy nieobecnosci */
	var self = this;
	$(cols).each(function(index, val) {
		var href = $(val).has('a')[0];
		if(href && $(href).text() === 'nb')
			self.absence.push(index);
	});
	this.hours = this.absence.length;

	/** Rejestracja w kolejce */
	if(this.hours) {
		var root_obj = $(cols[0]).parent(),
			/** Dodawanie nieobecności do listy do wygenerowania */
			addToQueue = function() { 
	        	queue[$(this).is(':checked')?'register':'delete'](self);
	        };
		$(root_obj)
			.prepend([
				$('<input/>', { type: 'checkbox', change: addToQueue }),
				'<strong>'+this.hours+'</strong>'
			]);
	}
};

/** Zbieranie nieobecności */
var 
	date_pattern = /(\d{4}-\d{2}-\d{2}) \((\D*).\)/,
	student 	 = $('div#user-section > b').text(),
	table 		 = 'div.container-background table.center.big.decorated ',
	queue 		 = new Queue;
$(table+'> tbody')
	.find('tr.line1, tr.line0')
	.each(function(key, obj) {
		var date = date_pattern.exec($(obj).children(':first').text());
		if(date)
			new Day(date, $(obj).find('td.center > p.box'));
	});

/** Przycisk usprawiedliwienia */
var btn = $('<input/>',
    {
    	type: 	'button',
        value: 	'Usprawiedliw!',
        click: 	_.bind(queue.dialog, queue)
    });
$(table+'> thead')
	.find('td.center.middle').eq(0)
	.empty().append(btn);

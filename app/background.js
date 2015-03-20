/** Kod wrzucany do nowej karty */
var inject_code = "\
	$('textarea#tresc_wiadomosci').val(data.content);\
	$('input#temat').val(data.title);\
	$('input#radio_wychowawca').trigger('click')";
/**
 * Wstrzykiwanie kodu uzupełniającego formularz
 * @param  {Assoc}  data Tytuł i zawartość usprawiedliwienia
 * @param  {Object} tab  Uchwyt zakładki
 */
var onTabCreate = function(data, tab) {
	chrome.tabs.executeScript(tab.id, {
	    code: 'var data = '+JSON.stringify(data)+';'+inject_code
	});
};
chrome.extension.onMessage.addListener(function(request, sender, send_resp) {
	/** Tworzenie nowych kart i insercja zawartości */
	var fork = function(data) {
		chrome.tabs.create({
			url: 'https://dziennik.librus.pl/wiadomosci/2/5'
		}, _.bind(onTabCreate, null, data));
	};
	_.each(request.queue, fork);
});
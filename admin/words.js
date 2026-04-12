/* eslint-disable no-undef */
/* exported systemDictionary */
systemDictionary = {
	"marstek-venus settings": {
		en: "Marstek Venus settings",
		de: "Marstek Venus Einstellungen",
	},
	ipAddress: {
		en: "Device IP Address",
		de: "Geräte IP Adresse",
	},
	udpPort: {
		en: "UDP Port",
		de: "UDP Port",
	},
	pollInterval: {
		en: "Poll interval (ms)",
		de: "Abfrageintervall (ms)",
	},
	autoDiscovery: {
		en: "Auto discover devices",
		de: "Geräte automatisch erkennen",
	},
	ipAddress_help: {
		en: "Leave empty to use auto-discovery, or enter the device's IP address if known",
		de: "Leer lassen um automatische Erkennung zu verwenden, oder geben Sie die IP-Adresse des Geräts ein, falls bekannt",
	},
	udpPort_help: {
		en: "UDP port for communication with the device (default 30000, must match the port configured in the Marstek mobile app)",
		de: "UDP-Port für die Kommunikation mit dem Gerät (Standard 30000, muss mit dem in der Marstek-Mobile-App konfigurierten Port übereinstimmen)",
	},
	pollInterval_help: {
		en: "How often to query the device for data (lower values for more real-time updates, higher for less device load)",
		de: "Wie oft das Gerät nach Daten abgefragt wird (niedrigere Werte für Echtzeit-Updates, höhere für geringere Gerätebelastung)",
	},
	fastPollInterval: {
		en: "Fast poll interval (ms) - power values",
		de: "Schnelles Abfrageintervall (ms) - Leistungswerte",
	},
	fastPollInterval_help: {
		en: "How often to query power values (pv, grid, battery, load). Lower values = faster updates for power data",
		de: "Wie oft Leistungswerte abgefragt werden (pv, grid, battery, load). Niedrigere Werte = schnellere Updates für Leistungsdaten",
	},
	requestTimeout: {
		en: "Request timeout (ms)",
		de: "Anfrage-Timeout (ms)",
	},
	requestTimeout_help: {
		en: "How long to wait for a response before retrying (higher for slow devices)",
		de: "Wie lange auf eine Antwort gewartet wird, bevor erneut versucht wird (höher für langsame Geräte)",
	},
	maxRetries: {
		en: "Max retries per request",
		de: "Max. Wiederholungen pro Anfrage",
	},
	maxRetries_help: {
		en: "Number of retry attempts if a request times out (0 = no retries)",
		de: "Anzahl der Wiederholungsversuche bei Timeout (0 = keine Wiederholungen)",
	},
	autoDiscovery_help: {
		en: "Enable automatic device discovery on the local network (recommended for first-time setup)",
		de: "Automatische Geräteerkennung im lokalen Netzwerk aktivieren (empfohlen für die Ersteinrichtung)",
	},
	discover: {
		en: "Discover devices",
		de: "Geräte suchen",
	},
};

# La Poste

Verfolge deine Sendungen von La Poste in Gladys: Colissimo, Chronopost und Einschreiben („lettre suivie“), über die
offizielle Sendungsverfolgungs-API von La Poste („Suivi“ v2).

> **Ohne die Hardware entwickelt** (hier: ohne API-Schlüssel von La Poste): Rückmeldungen sind im
> [Gladys-Forum](https://community.gladysassistant.com/) willkommen. Die Antworten der API wurden anhand ihrer
> Dokumentation simuliert.

## Was die Integration macht

- Du fügst eine Sendung mit ihrer Sendungsnummer hinzu (und auf Wunsch mit einem Namen), in der Konfiguration oder
  über eine Szene.
- Die Integration liest ihren Status alle 30 Minuten bei La Poste (einstellbar) und hört auf, sobald sie zugestellt
  ist.
- Ein Gerät „La Poste Sendungen“ liefert die Zähler (unterwegs, in Zustellung, abholbereit, Probleme, kürzlich
  zugestellt) und einen Übersichtssatz.
- Das Widget „Meine Sendungen“ listet deine Sendungen mit Status, letztem Schritt und Datum.
- Vier Szenen-Auslöser: in Zustellung, zugestellt, abholbereit, Problem. Zwei Szenen-Aktionen: Sendung verfolgen,
  meine Sendungen lesen.
- Eine zugestellte Sendung verlässt die Liste nach 7 Tagen von selbst (einstellbar).

## Voraussetzungen

- Gladys 5.1.0 oder neuer.
- Ein kostenloser API-Schlüssel von La Poste:
  1. lege ein Konto auf [developer.laposte.fr](https://developer.laposte.fr/) an;
  2. öffne die [API Suivi](https://developer.laposte.fr/products/suivi/latest) und abonniere ihren kostenlosen Tarif;
  3. kopiere den Schlüssel des Abos (den `X-Okapi-Key`, 64 Zeichen).
- Gladys braucht Internetzugang (`api.laposte.fr`).

## Konfiguration

Installiere die Integration über **Integrationen → Von GitHub installieren** mit der Adresse
`https://github.com/guim31/gladys-laposte` und öffne dann ihre Konfiguration.

| Einstellung                    | Standard       | Wirkung                                                                                                   |
| ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------- |
| API-Schlüssel                  | (erforderlich) | Der Schlüssel deines Abos „Suivi“. Er erscheint nie in den Protokollen.                                   |
| Leseintervall                  | 30 Minuten     | Wie oft jede Sendung unterwegs gelesen wird (15 Minuten bis 4 Stunden). Zugestellte werden nicht gelesen. |
| Zugestellte Sendungen behalten | 7 Tage         | Eine zugestellte oder zurückgesandte Sendung verlässt die Liste nach dieser Zeit (1 bis 30 Tage).         |
| Sprache                        | Französisch    | Funktionsnamen des neuen Geräts, Sprache der Texte von La Poste, der Meldungen und der Sätze.             |

Der Verbindungsstatus der Konfiguration zeigt, ob La Poste den Schlüssel akzeptiert.

Aktionen der Konfiguration:

- **Sendung hinzufügen**: Sendungsnummer (11 bis 15 Buchstaben und Ziffern, Leerzeichen erlaubt) und ein optionaler
  Name. Eine schon verfolgte Nummer behält ihre Sendung und bekommt den neuen Namen, wenn du einen angibst. Die
  Sendung wird sofort gelesen.
- **Sendung entfernen**: nach Name oder Nummer.
- **Sendungen jetzt lesen**: liest jede Sendung unterwegs, ohne auf das Intervall zu warten, und prüft den Schlüssel.

## Das Gerät

Lege das Gerät **La Poste Sendungen** im Tab **Entdecken** an. Es ist ein einziges Gerät für alle Sendungen: Eine
Sendung lebt nur ein paar Tage, und ein Gerät pro Sendung würde nach jeder Zustellung ein totes Gerät hinterlassen.

| Funktion            | Typ    | Inhalt                                                                      |
| ------------------- | ------ | --------------------------------------------------------------------------- |
| Sendungen unterwegs | Zähler | Noch nicht zugestellte Sendungen                                            |
| In Zustellung       | Zähler | Sendungen in der heutigen Tour des Briefträgers oder Fahrers                |
| Abholbereit         | Zähler | Sendungen, die in einer Postfiliale oder an einer Abholstelle warten        |
| Probleme            | Zähler | Verspätet, beim Zoll festgehalten, unzustellbar oder zurück an den Absender |
| Kürzlich zugestellt | Zähler | Zugestellte Sendungen, die noch in der Liste sind                           |
| Übersicht           | Text   | „Du hast 2 Sendungen unterwegs: Schuhe, in Zustellung; Buch, unterwegs.“    |

Die Zähler behalten ihren Verlauf und lassen sich in Szenen-Bedingungen nutzen.

## Das Widget

**Meine Sendungen** (Dashboard → Bearbeiten → ein Widget der Integration hinzufügen) listet bis zu 8 Sendungen, zuerst
die, die dich brauchen (in Zustellung, abholbereit, Problem), dann die anderen. Jede Zeile zeigt Namen,
Status-Abzeichen, letzten Schritt und Datum. Ein Tippen öffnet die Details: Zusteller, Nummer, erwartetes oder
Zustelldatum, Abholstelle, letzte Schritte und ein Link zur Verfolgungsseite von laposte.fr. Eine Zeile warnt, wenn
der Schlüssel fehlt oder abgelehnt wird oder La Poste nicht antwortet.

## Szenen-Auslöser

| Auslöser                       | Wann                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Eine Sendung ist in Zustellung | Die Sendung ist in der heutigen Tour                                                                          |
| Eine Sendung ist zugestellt    | La Poste meldet sie als zugestellt (nicht bei einer beim Hinzufügen schon zugestellten)                       |
| Eine Sendung ist abholbereit   | Die Sendung wartet in einer Postfiliale oder an einer Abholstelle, nach verpasster Zustellung oder auf Wunsch |
| Eine Sendung hat ein Problem   | Verspätung, unvollständige Adresse, Zoll, unzustellbar oder Rücksendung an den Absender                       |

Jeder Auslöser löst einmal aus, wenn die Sendung den Status erreicht, mit diesen Variablen: Name der Sendung,
Sendungsnummer, Status, letzter Schritt (Text von La Poste), Zusteller, Abholstelle, Verfolgungsseite.

## Szenen-Aktionen

- **Sendung verfolgen**: fügt eine Sendung zur Liste hinzu. Das Nummernfeld nimmt auch einen ganzen Text, etwa einen
  Mail-Betreff: Seine erste Sendungsnummer wird verwendet. Ausgaben: Nummer, Name, Status, neue Sendung (1 oder 0).
  Ohne Nummer im Text schlägt die Aktion fehl, und die Szene protokolliert es.
- **Meine Sendungen lesen**: gibt einen Satz mit den Sendungen unterwegs aus („Du hast 2 Sendungen unterwegs: …“) und
  die Anzahl der Sendungen unterwegs, in Zustellung und abholbereit.

## Szenen-Beispiele

- **Heute kommt ein Paket**: Auslöser „Eine Sendung ist in Zustellung“ → Nachricht „… kommt heute“ senden, mit der
  Variable „Name der Sendung“ des Auslösers.
- **Abholung nicht vergessen**: Auslöser „Eine Sendung ist abholbereit“ → Nachricht mit der Abholstelle.
- **Morgenüberblick**: jeden Tag um 8:00 → „Meine Sendungen lesen“ → den Satz auf einem Lautsprecher sagen, nur wenn
  „Sendungen unterwegs“ größer als 0 ist (Schritt „Nur fortsetzen, wenn“).
- **Verfolgung aus Mails**: mit einer Integration, die empfangene Mails in Auslöser verwandelt (IMAP), Auslöser „Mail
  von Colissimo empfangen“ → „Sendung verfolgen“ mit dem Betreff der Mail als Nummer.

## Fehlerbehebung

- **„La Poste lehnt den API-Schlüssel ab“**: Prüfe, ob du den Schlüssel des Abos „Suivi“ ohne Leerzeichen kopiert
  hast und ob das Abo auf developer.laposte.fr aktiv ist. Das Lesen startet wieder, sobald der Schlüssel geändert ist.
- **Eine Sendung bleibt „Noch unbekannt“**: La Poste kennt eine Sendung erst, wenn der Absender sie übergeben hat.
  Die Nummer bleibt und wird erneut gelesen; nach 30 Tagen ohne Antwort wird sie entfernt.
- **„La Poste-Kontingent erreicht“** oder **„antwortet gerade nicht“**: Das Lesen pausiert (eine Stunde oder die von
  La Poste genannte Zeit; 10 Minuten bei einem Ausfall) und startet dann von selbst wieder.
- **Kein Wert am Gerät**: Lege das Gerät im Tab „Entdecken“ an; seine Werte werden sofort gesendet.
- Ausführliche Protokolle: `LOG_LEVEL=debug` am Container.

## Grenzen

- **Ohne die Hardware entwickelt**: Ohne API-Schlüssel liefen die Tests auf Antworten, die anhand der
  API-Dokumentation simuliert wurden. Die ersten Nutzer werden zeigen, ob jeder Status richtig gelesen wird.
- Höchstens 50 Sendungen. Sendungen anderer Zusteller (DHL, UPS, Mondial Relay…) sind nicht abgedeckt.
- Das Kontingent des kostenlosen Tarifs steht auf developer.laposte.fr (10 Anfragen pro Sekunde beim Schreiben dieser
  Zeilen): Mit einer Anfrage pro Sendung alle 30 Minuten bleibt die Integration weit darunter. Die Nutzung der API
  folgt ihren Nutzungsbedingungen auf developer.laposte.fr.
- Die Texte der Schritte kommen von La Poste, in der Sprache der Konfiguration (Englisch, Französisch, Deutsch oder
  Spanisch).
- Die Funktionsnamen werden beim Anlegen des Geräts vergeben: Eine spätere Sprachänderung benennt sie nicht um.
- Keine Verbindung zu La Poste. La Poste, Colissimo und Chronopost sind Marken ihrer Inhaber.

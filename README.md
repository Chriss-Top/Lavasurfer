# Lava Surfer

Browserbasiertes Canvas-Arcadespiel ohne Build-Schritt oder JavaScript-Abhängigkeiten.

## Start

In diesem Verzeichnis `python3 -m http.server 8080` ausführen und die Seite im Browser öffnen. Alternativ `index.html` direkt öffnen. Die optionalen Webfonts benötigen Internet; lokale Ersatzschriften sind vorhanden.

## Spielen

Solo oder lokales Duell wählen und den Run starten. Ziel: je nach Level 18.000, 24.000 oder 30.000 Meter erreichen, bevor Brett und Turbo verbraucht sind – und dabei möglichst viele Trickpunkte sammeln.

- Spieler 1: ↑ springen, ↓ bremsen (in der Luft: Grab), ← Backflip / → Frontflip, Shift für Turbo, Leertaste für starken Heckantrieb, Enter zum Angreifen.
- Spieler 2: W springen, S bremsen (in der Luft: Grab), A Backflip / D Frontflip, F für Turbo, E für starken Heckantrieb, Q zum Angreifen.
- P oder der Pause-Knopf pausiert. **Neustart gibt es nur im Pausemenü per Mausklick** – die frühere R-Taste ist entfernt. Bei Fokusverlust wird automatisch pausiert.

## Dynamisches Surfen

- Die Lava wogt: Die Wellen wandern über die Strecke. Das Spieltempo ist gemäßigt (Turbo bis 280, Heckantrieb bis 460, Maximum 480).
- **Flow:** Wer im Tempobereich 150–270 über die Wellen fährt (Tempoanzeige wird grün), baut Flow auf (Anzeige im HUD, grüner Schimmer am Fahrer). Dann gibt es bergab mehr Schwung und bergauf weniger Verlust – und jeder Absprung trägt mit vollem Flow bis zu 45 % höher. Zu schnell oder zu langsam baut den Flow wieder ab; Bruchlandung und Wipeout setzen ihn auf null, perfekte Landungen geben etwas dazu.
- Absprünge berücksichtigen die Bewegung der Welle: Wer von einer steigenden Welle abhebt, fliegt höher. Bei Tempo hebt man an Kuppen automatisch ab.
- Sprungtaste halten = höherer Sprung, in der Luft erneut drücken = Doppelsprung.
- Drehungen haben Schwung (Beschleunigung und Nachdrehen). Grab in der Luft dreht schneller.
- Trickpunkte: Backflip/Frontflip, Double, Triple …, Lava-Grab, Doppelsprung und lange Airtime. Saubere Landungen bauen eine Combo bis ×5 auf (verfällt nach 4,5 s ohne Trick), perfekte Landungen geben ×1,5 und Extra-Tempo. Bruchlandungen beschädigen normale Bretter und löschen die Combo.
- Jeder vollständige Loop gibt 35 Turbo, eine saubere Landung nach Tricks weitere 15 (maximal 150).
- Turbo in der Luft lässt dich beim Fallen gleiten. Nach dem Schmelzen des Bretts mit Turbo auf den Düsen weiterfliegen.

## Monsterwellen

Etwa alle 3–4 km baut sich vor dir eine riesige Lavawelle auf und rollt über den Bildschirm auf dich zu; die Kamera zoomt heraus, damit du sie kommen siehst. Kurz bevor sie dich erreicht, bildet sich eine Lippe, die nach vorn überkippt und bricht. Danach zerfällt die Welle zu Schaum und Rauch.

- Mit Tempo die Wellenfront hoch: Die Welle wirft dich in die Luft – mit Flow etwas höher.
- Wer über die Kuppe fliegt, macht automatisch einen Supertrick: **LAVA-TORNADO** (Backflip mit Körperdrehung, 2.000 Punkte, +60 Turbo) – mit Diamantbrett die **DIAMANT-SUPERNOVA** (Double Backflip mit Körperdrehung und Diamantfunkeln, 4.000 Punkte). Automatische Tricks landen immer sauber.
- Wer zu langsam ist und unter der brechenden Lippe steckt, macht einen Wipeout: Tempoverlust, Schaden an normalen Brettern, Combo weg.

## Lava und Meteoriten

Gelegentliche Schauer werden zwei Sekunden vorher angekündigt. Warnlinien markieren herabfallende Gefahren. Durch Tempo, Bremsen und Sprünge ausweichen oder mit Enter (P1) / Q (P2) angreifen: normale Bretter erhalten Faustschläge, Diamantbretter einen durchgehend aktiven Diamantbohrer. Treffer geben 10 Turbo und 100 Punkte.

## Duell-Kamera

Die gemeinsame Kamera zoomt heraus, wenn die Spieler auseinanderfahren. Ist sie fast ganz herausgezoomt, wird der vordere Spieler sanft auf das Tempo des hinteren gebremst („WARTE AUF P2“). Weiter als die Kamera zeigen kann, kommt er nicht davon – so bleiben immer beide Spieler im Bild. Eine Monsterwelle wird nur dann zusätzlich ins Bild geholt, wenn beide Spieler trotzdem sichtbar bleiben.

## Bretter und Wiederaufbau

Vor dem Start oder Wiederaufbau kann jeder Spieler Normal oder Diamant wählen. Normale Bretter schmelzen und nehmen Landeschaden; Diamantbretter sind unzerstörbar, haben unbegrenzte Energie und machen den Supernova-Trick. Nach einem Tod baut eine beliebige Taste das Brett wieder auf, in der Nähe des noch fahrenden Mitspielers. Der beste Punktestand wird lokal im Browser gespeichert.

## Prüfung

`node --check game.js` prüft die Syntax. Browser-Smoke-Test mit Chromium/Playwright: Solo und Duell, Monsterwellen mit beiden Brettern (Tornado/Supernova), Wipeout, Pausemenü (R ohne Wirkung, Weiter und Neustart per Maus) ohne JavaScript-Laufzeitfehler geprüft.

# Lava Surfer

Browserbasiertes Canvas-Arcadespiel ohne Build-Schritt oder JavaScript-Abhängigkeiten.

## Start

In diesem Verzeichnis `python3 -m http.server 8080` ausführen und die Seite im Browser öffnen. Alternativ `index.html` direkt öffnen. Die optionalen Webfonts benötigen Internet; lokale Ersatzschriften sind vorhanden.

## Spielen

Solo oder lokales Duell wählen und den Run starten. Ziel: 12.000 Meter erreichen, bevor Brett und Turbo verbraucht sind.

- Spieler 1: → beschleunigen, ↑ springen, ↓ bremsen, ← rückwärts drehen, Shift für Turbo, Leertaste für starken Heckantrieb, Enter zum Angreifen.
- Spieler 2: D beschleunigen, W springen, S bremsen, A rückwärts drehen, F für Turbo, E für starken Heckantrieb, Q zum Angreifen.
- Gas/Bremse und Drehung sind unabhängig und können gleichzeitig gedrückt werden. Gedreht wird nur in der Luft; Springen per Tastendruck ist auf der Welle möglich; zusätzlich erfolgt der Absprung bei genügend Tempo automatisch über Wellen. Zum erneuten manuellen Springen die Sprungtaste loslassen und erneut drücken.
- Der Sprung ist höher; der zusätzliche Heckantrieb beschleunigt auch in der Luft stark nach rechts. Bei normalen Brettern benötigt er 38 Energie pro Sekunde (zusätzlich zu Turbo); Diamantbretter verbrauchen keine Energie. Nach dem Loslassen wird die hohe Geschwindigkeit allmählich abgebaut.
- Wellen können bei genügend Tempo an der Kuppe automatisch als Sprungschanze dienen.
- Jeder vollständige Looping gibt sofort 35 Turbo, eine saubere Landung weitere 15 (maximal 150); schiefe Landungen beschädigen das Brett.
- Nach dem Schmelzen des Bretts mit Turbo auf den Düsen weiterfliegen.
- P pausiert, R startet neu. Bei Fokusverlust wird automatisch pausiert.

Tastatur erforderlich. Der Zwei-Spieler-Modus nutzt eine gemeinsame Kamera.

## Prüfung

`node --check game.js` prüft die Syntax. Browser-Smoke-Test mit Chromium/Playwright: Rendering, zwei Spieler, Eingaben, Pause und Neustart ohne JavaScript-Laufzeitfehler geprüft.

## Wellen, Kamera und Wiederaufbau

Höhere Wellen mit vereinfachter Physik: Hangabtrieb, tangentiale Absprunggeschwindigkeit, Kontaktverlust durch Wellenkrümmung und ballistischer Flug mit Schwerkraft. Die gemeinsame Kamera passt Ausschnitt und Zoom an beide Spieler an, einschließlich hoher Sprünge und großer Abstände.

Vor dem Start oder Wiederaufbau kann jeder Spieler oben Normal oder Diamant wählen. Normale Bretter schmelzen und nehmen Landeschaden; Diamantbretter sind unzerstörbar und haben unbegrenzte Energie für Turbo und Heckantrieb. Nach einem Tod baut eine beliebige neu gedrückte Taste alle gerade gestorbenen Spieler wieder auf, in der Nähe des noch fahrenden Mitspielers. Die Auswahl gilt beim nächsten Wiederaufbau oder Neustart.

## Lava und Meteoriten

Gelegentliche Schauer werden zwei Sekunden vorher angekündigt. Warnlinien markieren herabfallende Gefahren. Durch Tempo, Bremsen und Sprünge ausweichen oder mit Enter (P1) / Q (P2) angreifen: normale Bretter erhalten wiederholte Faustschläge, Diamantbretter einen durchgehend aktiven Diamantbohrer. Angriffe wirken nur in Reichweite und geben bei Zerstörung 10 Turbo. Einschläge verlangsamen beide Spieler und beschädigen normale Bretter; Diamantbretter bleiben unzerstörbar. Ein kurzer Schutz nach Treffern verhindert Mehrfachschaden.

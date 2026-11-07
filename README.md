# Lava Surfer

Browserbasiertes Canvas-Arcadespiel ohne Build-Schritt oder JavaScript-Abhängigkeiten.

## Start

In diesem Verzeichnis `python3 -m http.server 8080` ausführen und die Seite im Browser öffnen. Alternativ `index.html` direkt öffnen. Die optionalen Webfonts benötigen Internet; lokale Ersatzschriften sind vorhanden.

## Spielen

Solo oder lokales Duell wählen und den Run starten. Ziel: 2.400 Meter erreichen, bevor Brett und Turbo verbraucht sind.

- Spieler 1: Pfeile links/rechts für Tempo und Rotation in der Luft, hoch zum Springen, runter für Turbo.
- Spieler 2: A/D, W und S entsprechend.
- Wellen können bei genügend Tempo automatisch als Sprungschanze dienen.
- Ein vollständiger Looping mit sauberer Landung füllt Turbo auf; schiefe Landungen beschädigen das Brett.
- Nach dem Schmelzen des Bretts mit Turbo auf den Düsen weiterfliegen.
- P pausiert, R startet neu. Bei Fokusverlust wird automatisch pausiert.

Tastatur erforderlich. Der Zwei-Spieler-Modus nutzt eine gemeinsame Kamera.

## Prüfung

`node --check game.js` prüft die Syntax. Browser-Smoke-Test mit Chromium/Playwright: Rendering, zwei Spieler, Eingaben, Pause und Neustart ohne JavaScript-Laufzeitfehler geprüft.

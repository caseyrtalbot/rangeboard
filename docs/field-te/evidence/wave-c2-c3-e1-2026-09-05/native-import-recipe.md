# Native import browser check

Verified on the final source using the isolated rangeboard-imports Chromium session at
<http://localhost:5207>. The earlier wave-imports-aborted.js.txt harness was interrupted by
Vite during a source fix and is retained as troubleshooting history, not passing evidence.

The stable native flow used Playwright CLI eval to call importScenarioFile, then upload
bad-scenario JSON through the resulting file chooser. The alert reported the invalid field;
serialized store data remained identical. importUnderlayImage followed by uploading the
captured native-image-import.png decoded a 1 by 1 PNG through FileReader/Image.
importLibraryFile followed by uploading native-library-import.json retained triangular
lo -0.2 / hi 0.3. browser-import-results.json records all three final assertions.
Use fresh isolated browser storage. No user browser profile was accessed.

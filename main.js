const http = require('http');
const puppeteer = require('puppeteer');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (
    req.method === 'GET' &&
    (req.url === '/' || req.url === '/index.html')
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });

    res.end(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Local Bot Panel</title>
      </head>

      <body>
        <h2>Local Bot Panel</h2>

        <label>Liczba botów:</label><br>
        <input
          type="number"
          id="count"
          value="5"
          min="1"
          max="50"
        >

        <br><br>

        <button onclick="startBot()">
          Uruchom
        </button>

        <p id="status"></p>

        <script>
          async function startBot() {
            const count =
              Number(document.getElementById('count').value);

            const statusEl =
              document.getElementById('status');

            statusEl.textContent =
              'Przygotowywanie kart...';

            const response = await fetch('/run-bot', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ count })
            });

            const result = await response.json();

            statusEl.textContent = result.message;
          }
        </script>
      </body>
      </html>
    `);

    return;
  }

  if (req.method === 'POST' && req.url === '/run-bot') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const count = Number(data.count);

        if (!Number.isInteger(count) || count < 1 || count > 50) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });

          res.end(JSON.stringify({
            status: 'error',
            message: 'Nieprawidłowa liczba kart.'
          }));

          return;
        }

        const browser = await puppeteer.launch({
          executablePath: '/usr/bin/chromium-browser',
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ]
        });

        const contexts = [];
        const pages = [];

        try {
          /*
           * ETAP 1
           * Tworzymy wszystkie osobne konteksty i karty.
           */

          for (let i = 1; i <= count; i++) {
            const context =
              await browser.createBrowserContext();

            const page =
              await context.newPage();

            contexts.push(context);
            pages.push(page);

            console.log(
              `Karta ${i}/${count} utworzona`
            );
          }

          /*
           * ETAP 2
           * Wszystkie karty przechodzą na lokalną stronę.
           */

          await Promise.all(
            pages.map(async (page, index) => {
              await page.goto(
                'http://localhost:3000',
                {
                  waitUntil: 'domcontentloaded'
                }
              );

              await page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
              });

              console.log(
                `Karta ${index + 1}/${count} gotowa`
              );
            })
          );

          /*
           * ETAP 3
           * BARIERA.
           *
           * Dopiero tutaj program znajduje się,
           * gdy wszystkie karty zakończyły poprzedni etap.
           */

          console.log(
            'Wszystkie karty są gotowe!'
          );

          /*
           * ETAP 4
           * Wspólna akcja.
           */

          await Promise.all(
            pages.map(async page => {
              await page.keyboard.press('Enter');
            })
          );

          console.log(
            'Wszystkie karty wykonały akcję.'
          );

          res.writeHead(200, {
            'Content-Type': 'application/json'
          });

          res.end(JSON.stringify({
            status: 'success',
            message:
              `Utworzono ${count} niezależnych kart.`
          }));

        } finally {
          /*
           * ETAP 5
           * Cleanup.
           */

          for (const context of contexts) {
            try {
              await context.close();
            } catch (err) {
              console.error(
                'Błąd zamykania kontekstu:',
                err.message
              );
            }
          }

          await browser.close();
        }

      } catch (error) {
        console.error(error);

        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'application/json'
          });

          res.end(JSON.stringify({
            status: 'error',
            message: error.message
          }));
        }
      }
    });

    return;
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8'
  });

  res.end('Not Found');
});

server.listen(3000, '0.0.0.0', () => {
  console.log(
    'Serwer działa na porcie 3000'
  );
});

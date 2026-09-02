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

  // Strona główna z formularzem do podania PIN-u, nicku i liczby botów
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="pl">
      <head><meta charset="UTF-8"><title>Kahoot Bot Panel</title></head>
      <body>
        <h2>Panel Botów Kahoot</h2>
        <label>PIN Gry:</label><br>
        <input type="text" id="pin" placeholder="np. 123456"><br><br>
        
        <label>Baza nicków (każdy bot dostanie numer):</label><br>
        <input type="text" id="nickname" value="Bot"><br><br>

        <label>Liczba botów:</label><br>
        <input type="number" id="count" value="5" min="1" max="50"><br><br>

        <button onclick="startBot()">Wypuść boty</button>
        <p id="status"></p>

        <script>
          async function startBot() {
            const pin = document.getElementById('pin').value;
            const nickname = document.getElementById('nickname').value;
            const count = document.getElementById('count').value;
            const statusEl = document.getElementById('status');

            if (!pin) {
              alert('Wpisz PIN!');
              return;
            }

            statusEl.textContent = 'Boty wchodzą do gry...';

            const response = await fetch('/run-bot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pin, nickname, count: Number(count) })
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

  // Obsługa uruchamiania botów
  if (req.method === 'POST' && req.url === '/run-bot') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const data = JSON.parse(body);
      const { pin, nickname, count } = data;

      console.log(`Uruchamianie ${count} botów równocześnie dla PIN: ${pin}`);

      try {
        const browser = await puppeteer.launch({ 
          executablePath: '/usr/bin/chromium-browser',
          headless: true, 
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });

        // Tworzymy tablicę zadań dla każdego bota
        const botTasks = [];

        for (let i = 0; i < count; i++) {
          botTasks.push((async () => {
            const context = await browser.createBrowserContext();
            const page = await context.newPage();
            
            try {
              await page.goto('https://kahoot.it', { waitUntil: 'networkidle2' });

              await page.waitForSelector('[data-functional-selector="game-pin-input"]');
              await page.type('[data-functional-selector="game-pin-input"]', pin);
              await page.keyboard.press('Enter');

              await page.waitForSelector('[data-functional-selector="username-input"]');
              await page.type('[data-functional-selector="username-input"]', `${nickname}_${i + 1}`);
              await page.keyboard.press('Enter');

              console.log(`Bot ${i + 1} dołączył do gry!`);
            } catch (err) {
              console.error(`Błąd u bota ${i + 1}:`, err.message);
            }
          })());
        }

        // Uruchamiamy wszystkie boty naraz i czekamy, aż wszystkie wejdą
        await Promise.all(botTasks);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: `Wszystkie ${count} botów zostało wysłanych błyskawicznie!` }));
      } catch (error) {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Błąd podczas uruchamiania botów.' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Serwer działa na porcie 3000');
});

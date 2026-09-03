if (req.method === 'POST' && req.url === '/run-bot') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const data = JSON.parse(body);
      const { pin, nickname, count } = data;

      console.log(`Uruchamianie ${count} botów równocześnie dla PIN: ${pin}`);

      try {
        const browser = await puppeteer.launch({ 
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
  }

# Koos töötamine

Kaks inimest, kumbki oma Claude'iga, üks repo. Reeglid on lihtsad, et töö ei läheks üksteise peale.

## Esimene kord

```sh
git clone https://github.com/arthurvalma49/varu.git
cd varu
npm install
npm run dev        # http://localhost:5173
```

Brauseri testid (`npm run test:e2e`) vajavad arvutisse Google Chrome'i. Salajasi võtmeid ega `.env` faili pole vaja.

## Iga muudatus

1. Alusta värskelt: `git checkout main && git pull`
2. Tee oma haru: `git checkout -b <nimi>/<mis>` (nt `arthur/varvid`, `mari/teavitused`)
3. Tee muudatus, käivita `npm test`, `npm run build` ja UI puhul `npm run test:e2e`
4. Push ja ava pull request: `git push -u origin HEAD` ja `gh pr create --fill`
5. GitHub käivitab testid (Checks). Vercel teeb preview lingi, ava see telefonis.
6. Teine vaatab üle ja merge'ib (Squash and merge). Merge'iga läheb see live'i.

**Ära pushi otse `main`-i.** `main` on alati see, mis on live'is.

## Kui mõlemad muudavad sama faili

Väiksed, lühiajalised harud (päev-kaks) hoiavad konflikte ära. Kui GitHub ütleb "conflicts":

```sh
git checkout main && git pull
git checkout <sinu-haru> && git merge main
# lahenda konfliktid (Claude oskab), siis
npm test && npm run build && git commit && git push
```

## Kes mida teeb

Enne suurema asja alustamist ava GitHubis Issue (või kirjuta teisele), et mõlemad ei teeks sama asja. Issue'd on ühine nimekiri: mis on pooleli, mis järgmisena.

## Claude'iga

Claude loeb `CLAUDE.md` ja `HANDOFF.md` ise. Ütle talle lihtsalt, mida teha; ta teeb haru, testib ja avab PR-i. Kui midagi olulist muutub (uus voog, otsus), lase tal uuendada `HANDOFF.md`, et teise Claude teaks.

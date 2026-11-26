import { chromium } from 'playwright';
const b = await chromium.launch();
const jobs = [['k5.html','icon-512.png',512],['k5.html','icon-192.png',192],['k5.html','apple-touch-icon.png',180],['k5.html','icon-1024.png',1024],['k5-maskable.html','maskable-512.png',512]];
for (const [src,out,n] of jobs) {
  const p = await b.newPage({ viewport: { width: n, height: n } });
  await p.goto('file://' + process.cwd() + '/' + src); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  console.log(out, await p.evaluate(() => document.fonts.check("700 40px 'Reem Kufi'")));
  await p.screenshot({ path: out }); await p.close();
}
await b.close();

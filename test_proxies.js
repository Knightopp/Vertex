const proxies = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.allorigins.win/get?url=",
  "https://thingproxy.freeboard.io/fetch/",
  "https://api.codetabs.com/v1/proxy?quest="
];

async function test() {
  const target = "https://store.steampowered.com/api/storesearch/?term=Elden%20Ring&l=english&cc=US";
  for (const proxy of proxies) {
    try {
      console.log(`Testing ${proxy}...`);
      const res = await fetch(`${proxy}${encodeURIComponent(target)}`);
      console.log(`${proxy} -> ${res.status}`);
      if (res.ok) {
         const txt = await res.text();
         console.log(txt.substring(0, 100));
      }
    } catch (e) {
      console.log(`${proxy} -> Error: ${e.message}`);
    }
  }
}
test();

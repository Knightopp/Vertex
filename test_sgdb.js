const API_KEY = "288f82310829b3ea5e4b2256d88dfe0a";
const BASE_URL = "https://www.steamgriddb.com/api/v2";

async function run() {
  const query = "Visual Studio Code";
  console.log("Searching for:", query);
  try {
      const targetUrl = `${BASE_URL}/search/autocomplete/${encodeURIComponent(query)}`;
      const response = await fetch(targetUrl, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Accept": "application/json"
        }
      });
      console.log("Status:", response.status);
      const json = await response.json();
      console.log(json);
  } catch (e) {
      console.error(e);
  }
}

run();

interface Env { ASSETS: Fetcher }

const SERVICE_REPLACEMENTS: Array<[string,string]> = [
  ['Starry ID 中央會員','繁星通行證'],
  ['繁星下載','繁星捕手'],
  ['繁星膠囊','繁星視界'],
  ['box.starry.phd','eye.starry.phd'],
  ['影片同步','繁星共振'],
  ['繁星語錄','繁星心鏡'],
  ['quotes.starry.phd','mirror.starry.phd']
];

const EMPTY_URANUS = '<div class="planet-wrap p7"><span class="celestial-name">天王星</span><div class="planet uranus"><span></span></div></div>';
const STARRY_AI_URANUS = '<div class="planet-wrap p7"><span class="celestial-name">天王星</span><div class="planet uranus"><span></span></div><em class="service-label"><b class="service-name">繁星副官</b><small class="service-host">ai.starry.phd</small></em></div>';

function canonicalizeHtml(html: string) {
  let next = html;
  for (const [from,to] of SERVICE_REPLACEMENTS) next = next.split(from).join(to);
  next = next.replace(EMPTY_URANUS, STARRY_AI_URANUS);
  return next;
}

export default {
  async fetch(request: Request, env: Env) {
    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control','no-cache');
    return new Response(canonicalizeHtml(await response.text()), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};

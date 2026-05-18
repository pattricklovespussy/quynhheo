import cheerio from 'cheerio';

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function normalizeWhitespace(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'text/html' },
      signal: controller.signal
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseItemListJsonLd(html) {
  const $ = cheerio.load(html);
  const jobs = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : [data];
      list.forEach(entry => {
        if (entry && entry['@type'] === 'ItemList' && Array.isArray(entry.itemListElement)) {
          entry.itemListElement.forEach((it, idx) => {
            const item = it.item || it;
            if (item && item.name && item.url) {
              jobs.push({
                id: `ld_${idx}_${item.url}`,
                title: normalizeWhitespace(item.name),
                company: '',
                location: '',
                url: item.url
              });
            }
          });
        }
      });
    } catch {
      return;
    }
  });
  return jobs;
}

function parseCards(html, selectors) {
  const $ = cheerio.load(html);
  const items = [];
  $(selectors.item).each((_, el) => {
    const title = normalizeWhitespace($(el).find(selectors.title).first().text());
    const company = normalizeWhitespace($(el).find(selectors.company).first().text());
    const location = normalizeWhitespace($(el).find(selectors.location).first().text());
    let url = $(el).find(selectors.url).first().attr('href') || '';
    if (url && url.startsWith('/')) url = selectors.base + url;
    if (!title || !url) return;
    items.push({ id: `${selectors.source}_${url}`, title, company, location, url });
  });
  return items;
}

async function fetchTopCV(keyword) {
  const url = `https://www.topcv.vn/tim-viec-lam?query=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'topcv',
    base: 'https://www.topcv.vn',
    item: '.job-item, .job-list-default .job-item',
    title: '.title, .job-title, h3 a',
    company: '.company, .company-name',
    location: '.address, .job-address, .city',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'topcv' }));
}

async function fetchVietnamWorks(keyword) {
  const url = `https://www.vietnamworks.com/viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'vietnamworks',
    base: 'https://www.vietnamworks.com',
    item: '.job-item, .job-item-v2, article',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .job-company',
    location: '.job-location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'vietnamworks' }));
}

async function fetchCareerBuilder(keyword) {
  const url = `https://careerbuilder.vn/viec-lam/${encodeURIComponent(keyword)}-k-vi.html`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'careerbuilder',
    base: 'https://careerbuilder.vn',
    item: '.job-item, .job, .job-list-item',
    title: '.job-title, h2 a, h3 a',
    company: '.company-name, .company a',
    location: '.location, .job-location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'careerbuilder' }));
}

async function fetchViecLam24h(keyword) {
  const url = `https://vieclam24h.vn/tim-kiem-viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'vieclam24h',
    base: 'https://vieclam24h.vn',
    item: '.job__item, .job-item, .list__job-item',
    title: '.job__item-title, .job-title, h3 a',
    company: '.job__item-company, .company-name',
    location: '.job__item-location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'vieclam24h' }));
}

async function fetchTimviec365(keyword) {
  const url = `https://timviec365.vn/tim-viec-lam.html?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'timviec365',
    base: 'https://timviec365.vn',
    item: '.item_tl, .job-item, .item_vt',
    title: '.job-title, h3 a, a.title',
    company: '.job-company, .comp_name, .company',
    location: '.job-location, .city, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'timviec365' }));
}

async function fetchMyWork(keyword) {
  const url = `https://mywork.com.vn/tim-kiem?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'mywork',
    base: 'https://mywork.com.vn',
    item: '.box-job, .job-item, .list_result .item',
    title: '.job-title, h2 a, h3 a',
    company: '.company-name, .company a',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'mywork' }));
}

async function fetchJobsGo(keyword) {
  const url = `https://jobsgo.vn/viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'jobsgo',
    base: 'https://jobsgo.vn',
    item: '.job-item, .item-job, .job-card',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .company a',
    location: '.job-location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'jobsgo' }));
}

async function fetchViecLamTot(keyword) {
  const url = `https://vieclamtot.com/viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'vieclamtot',
    base: 'https://vieclamtot.com',
    item: 'article, .job-item, .list__item',
    title: 'h3 a, h2 a, .title a',
    company: '.company, .company-name',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'vieclamtot' }));
}

async function fetchTimViecNhanh(keyword) {
  const url = `https://timviecnhanh.com/viec-lam?tu-khoa=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'timviecnhanh',
    base: 'https://timviecnhanh.com',
    item: '.list-job .job-item, .job-item, article',
    title: 'h3 a, h2 a, .job-title a',
    company: '.company-name, .company',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'timviecnhanh' }));
}

async function fetchITviec(keyword) {
  const url = `https://itviec.com/it-jobs?query=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'itviec',
    base: 'https://itviec.com',
    item: '.job, .job-card, .job-list-item',
    title: 'h3 a, h2 a, .job__title a',
    company: '.company-name, .job__company',
    location: '.job__location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'itviec' }));
}

function mapToJob(source, item) {
  return {
    id: `${source}_${item.id || item.url}`,
    title: item.title || '',
    company: item.company || source.toUpperCase(),
    logo: '',
    type: 'part-time',
    industry: '',
    location: item.location || 'Việt Nam',
    excerpt: '',
    description: '',
    url: item.url || '#',
    date: new Date().toISOString(),
    salaryMin: '',
    salaryMax: '',
    currency: 'VND',
    source
  };
}

export default async function handler(req, res) {
  const keyword = (req.query.keyword || 'part time').toString();
  const sources = [
    ['topcv', fetchTopCV],
    ['vietnamworks', fetchVietnamWorks],
    ['careerbuilder', fetchCareerBuilder],
    ['vieclam24h', fetchViecLam24h],
    ['timviec365', fetchTimviec365],
    ['mywork', fetchMyWork],
    ['jobsgo', fetchJobsGo],
    ['vieclamtot', fetchViecLamTot],
    ['timviecnhanh', fetchTimViecNhanh],
    ['itviec', fetchITviec]
  ];

  const results = await Promise.allSettled(
    sources.map(async ([key, fn]) => {
      const items = await fn(keyword);
      return items.map(item => mapToJob(key, item));
    })
  );

  const jobs = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ jobs });
}

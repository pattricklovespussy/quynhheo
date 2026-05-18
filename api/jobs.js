const cheerio = require('cheerio');

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function normalizeWhitespace(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPartTimeTitle(title) {
  const t = normalizeText(title);
  return t.includes('part time') || t.includes('part-time') || t.includes('parttime') || t.includes('ban thoi gian') || t.includes('ban-thoi-gian');
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

async function fetch123Job(keyword) {
  const url = `https://123job.vn/tim-kiem?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: '123job',
    base: 'https://123job.vn',
    item: '.job-item, .item-job, article',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .company a',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: '123job' }));
}

async function fetchCareerLink(keyword) {
  const url = `https://www.careerlink.vn/tim-viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'careerlink',
    base: 'https://www.careerlink.vn',
    item: '.job-item, .job, article',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .company a',
    location: '.job-location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'careerlink' }));
}

async function fetchViecoi(keyword) {
  const url = `https://viecoi.vn/tim-viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'viecoi',
    base: 'https://viecoi.vn',
    item: '.job-item, .item-job, article',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .company a',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'viecoi' }));
}

async function fetchJobstreet(keyword) {
  const url = `https://www.jobstreet.vn/vi/tim-viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'jobstreet',
    base: 'https://www.jobstreet.vn',
    item: 'article, .job-item, .job-card',
    title: 'h3 a, h2 a, .job-title a',
    company: '.company-name, .company a',
    location: '.job-location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'jobstreet' }));
}

async function fetchHRChannels(keyword) {
  const url = `https://hrchannels.com/tim-viec-lam?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'hrchannels',
    base: 'https://hrchannels.com',
    item: '.job-item, .item-job, article',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .company a',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'hrchannels' }));
}

async function fetchYbox(keyword) {
  const url = `https://ybox.vn/tuyen-dung?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'ybox',
    base: 'https://ybox.vn',
    item: '.box-job, .job-item, article',
    title: '.job-title, h3 a, h2 a',
    company: '.company-name, .company a',
    location: '.location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'ybox' }));
}

async function fetchGlints(keyword) {
  const url = `https://glints.com/vn/vi/opportunities/jobs/explore?keyword=${encodeURIComponent(keyword)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const jobs = parseCards(html, {
    source: 'glints',
    base: 'https://glints.com',
    item: 'article, .JobCard, .job-card',
    title: 'h3 a, h2 a, .JobCard__title a',
    company: '.JobCard__company, .company-name, .company a',
    location: '.JobCard__location, .location, .address',
    url: 'a'
  });
  return jobs.length ? jobs : parseItemListJsonLd(html).map(j => ({ ...j, source: 'glints' }));
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

module.exports = async function handler(req, res) {
  const rawKeyword = (req.query.keyword || '').toString().trim();
  const defaultKeywords = ['part time', 'part-time', 'ban thoi gian', 'bán thời gian', 'parttime'];
  const keywords = (rawKeyword ? rawKeyword.split('|') : defaultKeywords)
    .map(k => k.trim())
    .filter(Boolean);
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
    ['itviec', fetchITviec],
    ['123job', fetch123Job],
    ['careerlink', fetchCareerLink],
    ['viecoi', fetchViecoi],
    ['jobstreet', fetchJobstreet],
    ['hrchannels', fetchHRChannels],
    ['ybox', fetchYbox],
    ['glints', fetchGlints]
  ];

  const results = await Promise.allSettled(
    sources.map(async ([key, fn]) => {
      let items = [];
      for (const kw of keywords) {
        const batch = await fn(kw);
        if (batch && batch.length) {
          items = items.concat(batch);
        }
        if (items.length >= 40) break; // cap per source to avoid overload
      }
      return items
        .filter(item => isPartTimeTitle(item.title))
        .map(item => mapToJob(key, item));
    })
  );

  const jobs = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ jobs });
}

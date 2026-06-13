const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { handleContactEmail } = require('./email');

const DEFAULT_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const FALLBACK_PORT = process.env.PORT ? null : 8080;
let attemptedFallback = false;
const DATA_DIR = path.join(__dirname, 'data');
const FRONTEND_DIR = path.join(__dirname, '../frontend');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const slugify = (text) => String(text || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const articleSeedTopics = {
  school: [
    'Photosynthesis',
    'Newton’s Laws of Motion',
    'English Grammar Tenses',
    'French Revolution',
    'Periodic Table Elements',
    'Indian Freedom Struggle',
    'Fractions Decimals Percentages'
  ],
  competitive: [
    'Fundamental Rights in Indian Constitution',
    'SSC CGL Preparation Guide',
    'Important Abbreviations for Competitive Exams',
    'Reasoning Tricks and Shortcuts',
    'Basic Computer Knowledge for Exams'
  ],
  gk: [
    'Seven Wonders of the World',
    'Indian States and Capitals',
    'Famous Scientists and Inventions',
    'Important National and International Days',
    'Major Rivers of the World'
  ]
};

const authorByCategory = {
  school: ['Dr. Priya Sharma', 'Prof. Rajesh Kumar', 'Ms. Sunita Verma', 'Dr. Amit Tripathi', 'Mr. Vikas Gupta'],
  competitive: ['Adv. Ramesh Mishra', 'Saurabh Pandey', 'Ms. Sunita Verma', 'Prof. Meena Joshi', 'Mr. Vikas Gupta'],
  gk: ['Prof. Meena Joshi', 'Dr. Priya Sharma', 'Ms. Sunita Verma', 'Dr. Amit Tripathi']
};

const emojiByCategory = {
  school: ['🌿', '🍎', '📚', '🏰', '⚗️', '🔢', '🧪'],
  competitive: ['⚖️', '🏆', '📝', '🧠', '💻', '📊'],
  gk: ['🌍', '🇮🇳', '🗺️', '🔬', '📅', '🔎']
};

const buildArticleContent = (title, category) => {
  const base = title.replace(/([A-Z])/g, ' $1').trim();
  return `
<h2>Introduction</h2>
<p>${base} is an important topic for students preparing for school and competitive exams. This article explains the subject clearly with examples, definitions, and quick revision notes.</p>
<h2>Key Concepts</h2>
<ul>
  <li>Understand the main idea behind ${base}.</li>
  <li>Learn the most important terms and examples.</li>
  <li>Use these concepts to solve exam questions easily.</li>
</ul>
<h2>Important Examples</h2>
<p>Practice questions and examples help you remember ${base} better. Focus on the most common points that appear in class tests and exams.</p>
<h2>Exam Tips</h2>
<p>Read the definitions carefully, write short answers clearly, and revise the key terms before the exam.</p>
<h2>Summary</h2>
<p>${base} is now easier to understand after this quick guide. Remember the main points and practice regularly.</p>
  `;
};

const buildArticleContentHi = (title) => {
  const base = title.replace(/([A-Z])/g, ' $1').trim();
  return `
<h2>परिचय</h2>
<p>${base} एक महत्वपूर्ण विषय है जो छात्रों के लिए परीक्षा की तैयारी में मदद करता है। यह लेख सरल भाषा में मुख्य अवधारणाओं और उदाहरणों के साथ समझाता है।</p>
<h2>मुख्य अवधारणाएँ</h2>
<ul>
  <li>${base} का मुख्य विचार समझें।</li>
  <li>सबसे महत्वपूर्ण शब्दों और उदाहरणों को याद करें।</li>
  <li>परीक्षा के प्रश्नों को हल करने के लिए इन अवधारणाओं का उपयोग करें।</li>
</ul>
<h2>महत्वपूर्ण उदाहरण</h2>
<p>प्रैक्टिस प्रश्न और उदाहरण आपको ${base} को बेहतर तरीके से याद रखने में मदद करते हैं।</p>
<h2>परीक्षा सुझाव</h2>
<p>परिभाषाओं को ध्यान से पढ़ें, उत्तर स्पष्ट लिखें और परीक्षा से पहले मुख्य बिंदुओं को दोहराएँ।</p>
<h2>सारांश</h2>
<p>यह गाइड ${base} को समझना आसान बनाती है। मुख्य बिंदुओं को याद रखें और नियमित अभ्यास करें।</p>
  `;
};

const generateSlug = (title, existingSlugs) => {
  const baseSlug = slugify(title) || `article-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${suffix++}`;
  }
  return slug;
};

const createArticle = (title, category, existingArticles) => {
  const topic = title && title.trim().length > 0 ? title.trim() : randomItem(articleSeedTopics[category] || articleSeedTopics.gk);
  const existingSlugs = existingArticles.map(a => a.slug);
  const slug = generateSlug(topic, existingSlugs);
  const id = existingArticles.reduce((max, art) => Math.max(max, art.id || 0), 0) + 1;
  const articleCategory = ['school', 'competitive', 'gk'].includes(category) ? category : 'gk';
  const author = randomItem(authorByCategory[articleCategory]);
  const emoji = randomItem(emojiByCategory[articleCategory]);
  const readTime = 7 + Math.floor(Math.random() * 6);
  const tags = topic.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 6);

  return {
    id,
    slug,
    title: `${topic} - Complete Guide for Students`,
    title_hi: `${topic} - सम्पूर्ण गाइड`,
    category: articleCategory,
    emoji,
    excerpt: `A simple and exam-friendly guide on ${topic} with key concepts, examples, and revision points.`,
    author,
    date: new Date().toISOString().slice(0, 10),
    readTime,
    featured: false,
    tags,
    content: buildArticleContent(topic, articleCategory),
    content_hi: buildArticleContentHi(topic)
  };
};

const refreshCategoryCounts = () => {
  const categories = readData('categories.json');
  const articles = readData('articles.json');
  const updatedCategories = categories.map(cat => ({
    ...cat,
    count: articles.filter(article => article.category === cat.id).length
  }));
  writeData('categories.json', updatedCategories);
};

const ensureArticleSeed = () => {
  const articles = readData('articles.json');
  if (!Array.isArray(articles)) return;
  const minArticles = 20;
  const missing = Math.max(0, minArticles - articles.length);
  if (missing > 0) {
    const categories = ['school', 'competitive', 'gk'];
    const generated = [];
    for (let i = 0; i < missing; i += 1) {
      const category = categories[i % categories.length];
      generated.push(createArticle(null, category, articles.concat(generated)));
    }
    const allArticles = [...articles, ...generated];
    writeData('articles.json', allArticles);
    refreshCategoryCounts();
  }
};

const readData = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
  } catch (err) {
    return [];
  }
};

const writeData = (file, data) => {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

const send = (res, status, body, contentTypeOrHeaders = 'application/json; charset=utf-8') => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (typeof contentTypeOrHeaders === 'string') {
    headers['Content-Type'] = contentTypeOrHeaders;
  } else {
    Object.assign(headers, contentTypeOrHeaders);
  }

  res.writeHead(status, headers);
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    res.end(body);
  } else {
    res.end(JSON.stringify(body));
  }
};

const readBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1_000_000) {
      req.destroy();
      reject(new Error('Request body too large'));
    }
  });
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (err) {
      reject(new Error('Invalid JSON'));
    }
  });
});

const fetchJsonFromUrl = (sourceUrl) => new Promise((resolve, reject) => {
  try {
    const parsedUrl = new URL(sourceUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(parsedUrl, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve(json);
        } catch (err) {
          reject(new Error('Remote JSON parse failed'));
        }
      });
    });
    req.on('error', reject);
  } catch (err) {
    reject(err);
  }
});

const publicOrigin = (req) => {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || `localhost:${DEFAULT_PORT}`;
  return `${proto}://${host}`;
};

const getArticles = (query) => {
  let articles = readData('articles.json');
  const category = query.get('category');
  const search = query.get('search');
  const limit = Number.parseInt(query.get('limit'), 10);
  const page = Number.parseInt(query.get('page') || '1', 10);

  if (category && category !== 'all') {
    articles = articles.filter(article => article.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    articles = articles.filter(article =>
      article.title.toLowerCase().includes(q) ||
      (article.title_hi || '').toLowerCase().includes(q) ||
      article.excerpt.toLowerCase().includes(q) ||
      article.tags.join(' ').toLowerCase().includes(q)
    );
  }

  const perPage = Number.isFinite(limit) && limit > 0 ? limit : articles.length;
  const start = (Number.isFinite(page) && page > 0 ? page - 1 : 0) * perPage;
  return articles.slice(start, start + perPage);
};

const handleApi = async (req, res, url) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, service: 'BrightMind', timestamp: new Date().toISOString() });
  }

  if (req.method === 'GET' && url.pathname === '/api/categories') {
    return send(res, 200, readData('categories.json'));
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    const articles = readData('articles.json');
    const categories = readData('categories.json');
    return send(res, 200, {
      totalArticles: articles.length,
      categories: categories.length,
      school: articles.filter(article => article.category === 'school').length,
      competitive: articles.filter(article => article.category === 'competitive').length,
      gk: articles.filter(article => article.category === 'gk').length
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/articles') {
    return send(res, 200, getArticles(url.searchParams));
  }

  if (req.method === 'POST' && url.pathname === '/api/generate-article') {
    const body = await readBody(req);
    const articles = readData('articles.json');
    const article = createArticle(body.title || null, body.category || 'gk', articles);
    articles.unshift(article);
    writeData('articles.json', articles);
    refreshCategoryCounts();
    return send(res, 200, { success: true, article });
  }

  if (req.method === 'POST' && url.pathname === '/api/import-articles') {
    const body = await readBody(req);
    if (!body.url) {
      return send(res, 400, { error: 'Import URL is required.' });
    }

    let remoteData;
    try {
      remoteData = await fetchJsonFromUrl(body.url);
    } catch (err) {
      return send(res, 500, { error: 'Unable to fetch remote data.', detail: err.message });
    }

    if (!Array.isArray(remoteData)) {
      return send(res, 400, { error: 'Remote source must return a JSON array of articles.' });
    }

    const articles = readData('articles.json');
    const imported = [];
    for (const item of remoteData.slice(0, 20)) {
      const title = String(item.title || item.heading || item.name || 'New Article').trim();
      const category = ['school', 'competitive', 'gk'].includes(String(item.category || '').toLowerCase()) ? String(item.category).toLowerCase() : 'gk';
      const excerpt = String(item.excerpt || item.summary || `A clear guide to ${title}.`).trim();
      const article = createArticle(title, category, articles.concat(imported));
      article.excerpt = excerpt;
      article.author = String(item.author || article.author).trim();
      article.emoji = String(item.emoji || article.emoji).trim();
      article.tags = Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean).slice(0, 6) : article.tags;
      article.content = String(item.content || article.content).trim();
      if (item.content_hi) article.content_hi = String(item.content_hi).trim();
      imported.push(article);
    }

    const allArticles = [...imported, ...articles];
    writeData('articles.json', allArticles);
    refreshCategoryCounts();
    return send(res, 200, { success: true, imported: imported.length, imported });
  }

  if (req.method === 'POST' && url.pathname === '/api/seed-articles') {
    const body = await readBody(req);
    const count = Math.min(20, Math.max(1, Number(body.count) || 5));
    const articles = readData('articles.json');
    const generated = [];
    for (let i = 0; i < count; i += 1) {
      const article = createArticle(null, ['school', 'competitive', 'gk'][i % 3], articles.concat(generated));
      generated.push(article);
    }
    const allArticles = [...generated, ...articles];
    writeData('articles.json', allArticles);
    refreshCategoryCounts();
    return send(res, 200, { success: true, count: generated.length, generated });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/articles/')) {
    const slug = decodeURIComponent(url.pathname.replace('/api/articles/', ''));
    const article = readData('articles.json').find(item => item.slug === slug);
    return article
      ? send(res, 200, article)
      : send(res, 404, { error: 'Article not found' });
  }

  if (req.method === 'POST' && url.pathname === '/api/contact') {
    const body = await readBody(req);
    const { name, email, subject, message } = body;
    if (!name || !email || !message) {
      return send(res, 400, { error: 'Name, email and message are required.' });
    }

    const contactData = {
      id: (readData('contacts.json') || []).length + 1,
      name: String(name).trim(),
      email: String(email).trim(),
      subject: subject ? String(subject).trim() : 'General Inquiry',
      message: String(message).trim(),
      date: new Date().toISOString()
    };

    const contacts = readData('contacts.json') || [];
    contacts.push(contactData);
    writeData('contacts.json', contacts);

    const emailResult = await handleContactEmail(contactData);

    return send(res, 200, {
      success: true,
      message: 'Message received. Check your email for confirmation.',
      emailStatus: emailResult
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/newsletter') {
    const body = await readBody(req);
    const email = String(body.email || '').trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return isValid
      ? send(res, 200, { success: true, message: 'Successfully subscribed.' })
      : send(res, 400, { error: 'Valid email required' });
  }

  return send(res, 404, { error: 'API route not found' });
};

const handleSitemap = (req, res) => {
  const origin = publicOrigin(req);
  const staticPages = ['index.html', 'articles.html', 'about.html', 'contact.html', 'privacy-policy.html'];
  const articleUrls = readData('articles.json').map(article => ({
    loc: `${origin}/article.html?slug=${encodeURIComponent(article.slug)}`,
    lastmod: article.date,
    priority: '0.7'
  }));
  const pageUrls = staticPages.map(page => ({
    loc: `${origin}/${page}`,
    priority: page === 'index.html' ? '1.0' : '0.8'
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...pageUrls, ...articleUrls].map(item => `  <url>
    <loc>${item.loc}</loc>
    ${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  send(res, 200, xml, 'application/xml; charset=utf-8');
};

const handleRobots = (req, res) => {
  send(res, 200, `User-agent: *
Allow: /
Disallow: /admin.html

Sitemap: ${publicOrigin(req)}/sitemap.xml
`, 'text/plain; charset=utf-8');
};

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const handleFeed = (req, res) => {
  const origin = publicOrigin(req);
  const articles = readData('articles.json')
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BrightMind Latest Articles</title>
    <link>${origin}/</link>
    <description>Free educational articles for school, competitive exams, and general knowledge.</description>
    <language>en-IN</language>
${articles.map(article => `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${origin}/article.html?slug=${encodeURIComponent(article.slug)}</link>
      <guid>${origin}/article.html?slug=${encodeURIComponent(article.slug)}</guid>
      <pubDate>${new Date(article.date).toUTCString()}</pubDate>
      <description>${escapeXml(article.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`;

  send(res, 200, xml, 'application/rss+xml; charset=utf-8');
};

const serveStatic = (req, res, url) => {
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(FRONTEND_DIR, requested));

  if (!filePath.startsWith(FRONTEND_DIR)) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return send(res, 404, 'Page not found', 'text/plain; charset=utf-8');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': contentType };
    
    // Core Web Vitals: Cache static files for speed, exclude HTML to ensure updates
    if (['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'].includes(ext)) {
      headers['Cache-Control'] = 'public, max-age=86400, must-revalidate';
    } else if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache, must-revalidate';
    }
    
    send(res, 200, data, headers);
  });
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, publicOrigin(req));

    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method === 'GET' && url.pathname === '/sitemap.xml') return handleSitemap(req, res);
    if (req.method === 'GET' && url.pathname === '/robots.txt') return handleRobots(req, res);
    if (req.method === 'GET' && url.pathname === '/feed.xml') return handleFeed(req, res);
    if (req.method === 'GET') return serveStatic(req, res, url);

    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return send(res, 500, { error: 'Server error' });
  }
});

refreshCategoryCounts();
ensureArticleSeed();

const startServer = (port) => {
  server.listen(port, () => {
    console.log('BrightMind server running');
    console.log(`PORT=${port}`);
    console.log(`Website: http://localhost:${port}`);
    console.log(`API: http://localhost:${port}/api`);
  });
};

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && FALLBACK_PORT && !attemptedFallback) {
    attemptedFallback = true;
    console.warn(`Port ${DEFAULT_PORT} is already in use. Trying fallback port ${FALLBACK_PORT}...`);
    startServer(FALLBACK_PORT);
    return;
  }

  console.error('Server failed to start:', err);
  process.exit(1);
});

startServer(DEFAULT_PORT);

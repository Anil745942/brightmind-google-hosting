/* ===== GYANOLOGY - MAIN JAVASCRIPT ===== */

const LOCAL_API_CANDIDATES = ['http://localhost:8080/api', 'http://localhost:3000/api'];

const resolveApiBases = () => {
  const bases = [];
  if (window.location.protocol !== 'file:' && window.location.origin && window.location.origin !== 'null') {
    bases.push(`${window.location.origin}/api`);
  }
  return [...bases, ...LOCAL_API_CANDIDATES];
};

const LocalContentStore = {
  get data() {
    return window.GYANOLOGY_DATA || { articles: [], categories: [] };
  },

  getArticles(params = new URLSearchParams()) {
    let articles = [...this.data.articles];
    const category = params.get('category');
    const search = params.get('search');
    const limit = Number.parseInt(params.get('limit'), 10);
    const page = Number.parseInt(params.get('page') || '1', 10);

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

    if (!Number.isFinite(limit) || limit <= 0) return articles;
    const start = (Number.isFinite(page) && page > 0 ? page - 1 : 0) * limit;
    return articles.slice(start, start + limit);
  },

  getStats() {
    const articles = this.data.articles;
    return {
      totalArticles: articles.length,
      categories: this.data.categories.length,
      school: articles.filter(article => article.category === 'school').length,
      competitive: articles.filter(article => article.category === 'competitive').length,
      gk: articles.filter(article => article.category === 'gk').length
    };
  },

  get(endpoint) {
    const url = new URL(endpoint, 'https://gyanology.local');
    if (url.pathname === '/stats') return this.getStats();
    if (url.pathname === '/categories') return this.data.categories;
    if (url.pathname === '/articles') return this.getArticles(url.searchParams);
    if (url.pathname.startsWith('/articles/')) {
      const slug = decodeURIComponent(url.pathname.replace('/articles/', ''));
      return this.data.articles.find(article => article.slug === slug) || null;
    }
    return null;
  },

  post(endpoint, data) {
    if (endpoint === '/contact') {
      const messages = JSON.parse(localStorage.getItem('bm-local-contact-messages') || '[]');
      messages.push({ ...data, date: new Date().toISOString() });
      localStorage.setItem('bm-local-contact-messages', JSON.stringify(messages));
      return { success: true, message: 'Message saved locally.' };
    }

    if (endpoint === '/newsletter') {
      const subscribers = JSON.parse(localStorage.getItem('bm-local-newsletter') || '[]');
      subscribers.push({ email: data.email, date: new Date().toISOString() });
      localStorage.setItem('bm-local-newsletter', JSON.stringify(subscribers));
      return { success: true, message: 'Subscription saved locally.' };
    }

    return null;
  }
};

const API = {
  async fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`API error ${response.status}`);
    return await response.json();
  },

  async get(endpoint) {
    const bases = resolveApiBases();
    for (const base of bases) {
      try {
        return await this.fetchJson(`${base}${endpoint}`);
      } catch (err) {
        console.warn(`API GET failed for ${base}${endpoint}:`, err);
      }
    }
    const localData = LocalContentStore.get(endpoint);
    if (localData) {
      console.info(`Loaded ${endpoint} from local content data.`);
      return localData;
    }
    console.error('API GET error: backend and local content fallback are unavailable.');
    return null;
  },

  async post(endpoint, data) {
    const bases = resolveApiBases();
    for (const base of bases) {
      try {
        return await this.fetchJson(`${base}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (err) {
        console.warn(`API POST failed for ${base}${endpoint}:`, err);
      }
    }
    const localResult = LocalContentStore.post(endpoint, data);
    if (localResult) {
      console.info(`Saved ${endpoint} locally because backend is unavailable.`);
      return localResult;
    }
    console.error('API POST error: backend and local fallback are unavailable.');
    return null;
  }
};

const SEOManager = {
  setMeta(name, content, attr = 'name') {
    if (!content) return;
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  },

  setCanonical(url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  },

  setJsonLd(id, data) {
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  },

  updateArticle(article, title) {
    const description = article.excerpt || `Read ${title} on Gyanology.`;
    const canonicalUrl = window.location.href;
    SEOManager.updateArticle(a, title);
    this.setMeta('description', description);
    this.setMeta('og:title', `${title} | Gyanology`, 'property');
    this.setMeta('og:description', description, 'property');
    this.setMeta('og:type', 'article', 'property');
    this.setMeta('og:url', canonicalUrl, 'property');
    this.setMeta('twitter:card', 'summary');
    this.setMeta('twitter:title', `${title} | Gyanology`);
    this.setMeta('twitter:description', description);
    this.setCanonical(canonicalUrl);
    this.setJsonLd('article-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      datePublished: article.date,
      dateModified: article.date,
      author: {
        '@type': 'Person',
        name: article.author || 'Gyanology Editorial Team'
      },
      publisher: {
        '@type': 'Organization',
        name: 'Gyanology'
      },
      articleSection: article.category,
      keywords: Array.isArray(article.tags) ? article.tags.join(', ') : undefined,
      mainEntityOfPage: canonicalUrl
    });
  }
};

// ===== THEME MANAGER =====
const ThemeManager = {
  init() {
    const saved = localStorage.getItem('bm-theme') || 'dark';
    this.apply(saved);
  },
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bm-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.apply(current === 'dark' ? 'light' : 'dark');
  }
};

// ===== NAVBAR MANAGER =====
const NavManager = {
  init() {
    window.addEventListener('scroll', () => {
      const nav = document.querySelector('.navbar');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    });
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
        hamburger.classList.toggle('active');
      });
      document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
          mobileMenu.classList.remove('open');
          hamburger.classList.remove('active');
        }
      });
    }
    // Highlight active link
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        link.classList.add('active');
      }
    });
  }
};

const getSkeletonsHTML = (count = 3) => {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton-image skeleton-shimmer"></div>
        <div class="skeleton-body">
          <div class="skeleton-meta">
            <div class="skeleton-bar skeleton-shimmer" style="width: 60px;"></div>
            <div class="skeleton-bar skeleton-shimmer" style="width: 80px;"></div>
          </div>
          <div class="skeleton-title skeleton-shimmer" style="width: 80%; height: 20px;"></div>
          <div class="skeleton-excerpt skeleton-shimmer" style="width: 90%; height: 14px;"></div>
          <div class="skeleton-excerpt-short skeleton-shimmer" style="width: 60%; height: 14px;"></div>
          <div class="skeleton-footer">
            <div class="skeleton-author">
              <div class="skeleton-avatar skeleton-shimmer" style="width: 28px; height: 28px; border-radius: 50%;"></div>
              <div class="skeleton-author-name skeleton-shimmer" style="width: 60px; height: 12px;"></div>
            </div>
            <div class="skeleton-arrow skeleton-shimmer" style="width: 32px; height: 32px; border-radius: 50%;"></div>
          </div>
        </div>
      </div>
    `;
  }
  return html;
};

// ===== ARTICLES MANAGER (Articles Page) =====
const ArticlesManager = {
  all: [],
  filtered: [],
  currentCategory: 'all',
  currentSearch: '',
  currentPage: 1,
  perPage: 9,
  currentLang: 'en',

  async init() {
    // URL Parameter Parsing for navigation filtering
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get('cat') || params.get('category');
    const searchParam = params.get('search') || params.get('q');

    if (catParam && catParam !== 'all') {
      this.currentCategory = catParam;
      // Align tab state
      document.querySelectorAll('[data-cat]').forEach(tab => {
        if (tab.dataset.cat === catParam) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    if (searchParam) {
      this.currentSearch = searchParam.toLowerCase().trim();
      const input = document.getElementById('search-input');
      if (input) {
        input.value = searchParam;
      }
      const clearBtn = document.getElementById('search-clear');
      if (clearBtn) {
        clearBtn.classList.add('visible');
      }
    }

    const data = await API.get('/articles');
    if (data) {
      this.all = data;
      this.updateSavedBadgeCount();
      this.applyFilters();
    } else {
      const container = document.getElementById('articles-container');
      if (container) container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><h3>Server se connect nahi ho pa raha</h3><p>Backend server start hai? <code>node server.js</code> run karein.</p></div>`;
    }
  },

  filter(category) {
    this.currentCategory = category;
    this.currentPage = 1;
    this.applyFilters();
  },

  searchTimeout: null,
  search(query) {
    this.currentSearch = query.toLowerCase().trim();
    this.currentPage = 1;
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.applyFilters();
    }, 600);

    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);
  },

  async applyFilters() {
    let searchResults = [];
    const container = document.getElementById('articles-container');
    if (container) {
      container.innerHTML = getSkeletonsHTML(this.perPage);
    }
    
    const bookmarks = JSON.parse(localStorage.getItem('bm-bookmarks') || '[]');
    this.updateSavedBadgeCount();

    if (this.currentSearch) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1; padding: 40px; text-align: center;">
            <div style="font-size: 50px; margin-bottom: 20px; display: inline-block; animation: bounce 1s infinite alternate;">🔍📚</div>
            <h3 style="font-size: 20px; color: var(--text-primary); margin-bottom: 8px;">Searching online...</h3>
            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto; font-size: 14px;">Hum is topic par material collect kar rahe hain. Kripya 2-3 seconds wait karein...</p>
          </div>
        `;
      }
      
      const endpoint = `/articles?search=${encodeURIComponent(this.currentSearch)}`;
      const data = await API.get(endpoint);
      if (data) {
        searchResults = data;
      }
      this.filtered = searchResults.filter(article => {
        if (this.currentCategory === 'saved') {
          return bookmarks.includes(article.slug);
        }
        return this.currentCategory === 'all' || article.category === this.currentCategory;
      });
    } else {
      searchResults = this.all;
      this.filtered = searchResults.filter(article => {
        if (this.currentCategory === 'saved') {
          return bookmarks.includes(article.slug);
        }
        return this.currentCategory === 'all' || article.category === this.currentCategory;
      });
    }
    setTimeout(() => {
      this.render();
    }, 400);
  },

  updateSavedBadgeCount() {
    const bookmarks = JSON.parse(localStorage.getItem('bm-bookmarks') || '[]');
    const badge = document.getElementById('saved-count');
    if (badge) {
      badge.textContent = bookmarks.length;
      badge.style.display = bookmarks.length > 0 ? 'inline-block' : 'none';
    }
  },

  render() {
    const container = document.getElementById('articles-container');
    if (!container) return;
    const start = (this.currentPage - 1) * this.perPage;
    const pageArticles = this.filtered.slice(start, start + this.perPage);

    if (pageArticles.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><h3>Koi article nahi mila</h3><p>Koi aur search term ya category try karein.</p></div>`;
      const pc = document.getElementById('pagination-container');
      if (pc) pc.innerHTML = '';
      return;
    }

    container.innerHTML = pageArticles.map(a => this.cardHTML(a)).join('');
    this.renderPagination();
    container.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', () => { window.location.href = `article.html?slug=${card.dataset.slug}`; });
    });
  },

  cardHTML(a) {
    const title = (this.currentLang === 'hi' && a.title_hi) ? a.title_hi : a.title;
    const catMap = { school: { label: '🎒 School', cls: 'card-image-school' }, competitive: { label: '🏆 Competitive', cls: 'card-image-competitive' }, gk: { label: '🌍 General Knowledge', cls: 'card-image-gk' } };
    const cat = catMap[a.category] || { label: a.category, cls: '' };
    return `<div class="article-card" data-slug="${a.slug}">
      <div class="card-image ${cat.cls}"><span style="font-size:56px">${a.emoji}</span></div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-category">${cat.label}</span>
          <span class="card-read-time">⏱️ ${a.readTime} min</span>
        </div>
        <h3 class="card-title-text">${title}</h3>
        <p class="card-excerpt">${a.excerpt}</p>
        <div class="card-footer">
          <div class="card-author">
            <div class="author-avatar">${a.author.charAt(0)}</div>
            <span>${a.author.split(' ').slice(0,2).join(' ')}</span>
          </div>
          <div class="card-arrow">→</div>
        </div>
      </div>
    </div>`;
  },

  renderPagination() {
    const container = document.getElementById('pagination-container');
    if (!container) return;
    const totalPages = Math.ceil(this.filtered.length / this.perPage);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '<div class="pagination">';
    if (this.currentPage > 1) html += `<button class="page-btn" onclick="ArticlesManager.goToPage(${this.currentPage - 1})">←</button>`;
    for (let i = 1; i <= totalPages; i++) html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="ArticlesManager.goToPage(${i})">${i}</button>`;
    if (this.currentPage < totalPages) html += `<button class="page-btn" onclick="ArticlesManager.goToPage(${this.currentPage + 1})">→</button>`;
    html += '</div>';
    container.innerHTML = html;
  },

  goToPage(page) {
    this.currentPage = page;
    this.render();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
};

// ===== HOME MANAGER =====
const HomeManager = {
  async init() {
    const stats = await API.get('/stats');
    if (stats) {
      const el = id => document.getElementById(id);
      if (el('stat-articles')) el('stat-articles').textContent = stats.totalArticles + '+';
      if (el('stat-school')) el('stat-school').textContent = stats.school;
      if (el('stat-competitive')) el('stat-competitive').textContent = stats.competitive;
      if (el('stat-gk')) el('stat-gk').textContent = stats.gk;
    }
    await this.loadArticles('all');
    document.querySelectorAll('[data-cat]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-cat]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.loadArticles(tab.dataset.cat);
      });
    });
  },

  async loadArticles(category) {
    const container = document.getElementById('featured-articles');
    if (container) {
      container.innerHTML = getSkeletonsHTML(3);
    }
    const endpoint = category === 'all' ? '/articles?limit=6' : `/articles?category=${category}&limit=6`;
    const data = await API.get(endpoint);
    if (!container) return;
    if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Articles load nahi ho sake.</p></div>'; return; }

    const catMap = { school: { label: '🎒 School', cls: 'card-image-school' }, competitive: { label: '🏆 Competitive', cls: 'card-image-competitive' }, gk: { label: '🌍 General Knowledge', cls: 'card-image-gk' } };
    container.innerHTML = data.map(a => {
      const cat = catMap[a.category] || { label: a.category, cls: '' };
      return `<div class="article-card" onclick="window.location.href='article.html?slug=${a.slug}'" data-slug="${a.slug}">
        <div class="card-image ${cat.cls}"><span style="font-size:56px">${a.emoji}</span></div>
        <div class="card-body">
          <div class="card-meta"><span class="card-category">${cat.label}</span><span class="card-read-time">⏱️ ${a.readTime} min</span></div>
          <h3 class="card-title-text">${a.title}</h3>
          <p class="card-excerpt">${a.excerpt}</p>
          <div class="card-footer">
            <div class="card-author"><div class="author-avatar">${a.author.charAt(0)}</div><span>${a.author.split(' ').slice(0,2).join(' ')}</span></div>
            <div class="card-arrow">→</div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
};

// ===== ARTICLE DETAIL MANAGER =====
const ArticleDetail = {
  article: null,
  currentLang: 'en',

  async init() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (!slug) { window.location.href = 'articles.html'; return; }

    const article = await API.get(`/articles/${slug}`);
    if (!article) { window.location.href = 'articles.html'; return; }

    this.article = article;
    this.render('en');
    this.initReadingProgress();
    this.loadRelated(article.category, slug);
    
    // Initialize new 5/5 star widgets
    QuizManager.init(article.category);
    NotesCopyManager.init();

    document.getElementById('lang-en')?.addEventListener('click', () => {
      this.currentLang = 'en';
      document.getElementById('lang-en').classList.add('active');
      document.getElementById('lang-hi').classList.remove('active');
      this.render('en');
    });
    document.getElementById('lang-hi')?.addEventListener('click', () => {
      this.currentLang = 'hi';
      document.getElementById('lang-hi').classList.add('active');
      document.getElementById('lang-en').classList.remove('active');
      this.render('hi');
    });
  },

  render(lang) {
    const a = this.article;
    const title = (lang === 'hi' && a.title_hi) ? a.title_hi : a.title;
    const content = (lang === 'hi' && a.content_hi) ? a.content_hi : a.content;

    document.title = `${title} | Gyanology`;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
    set('article-title', title);
    set('article-content', content);
    set('article-date', new Date(a.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));
    set('article-author', a.author);
    set('article-read-time', `${a.readTime} min read`);
    set('article-category', a.category.charAt(0).toUpperCase() + a.category.slice(1));
    set('article-emoji', a.emoji);
    set('breadcrumb-title', title.length > 45 ? title.substring(0, 45) + '...' : title);
    const tagsEl = document.getElementById('article-tags');
    if (tagsEl) tagsEl.innerHTML = a.tags.map(t => `<span class="tag">#${t}</span>`).join('');

    // Dynamic SEO Updates for Search Crawlers
    const currentOrigin = window.location.origin;
    const articleUrl = `${currentOrigin}/article.html?slug=${encodeURIComponent(a.slug)}`;
    const articleImage = a.emoji ? `https://emojicdn.elk.sh/${encodeURIComponent(a.emoji)}?style=twitter` : `${currentOrigin}/desktop-home.png`;

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = articleUrl;

    // Meta Description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.name = 'description';
      document.head.appendChild(descMeta);
    }
    descMeta.content = a.excerpt;

    // Open Graph Meta Tags
    const setOg = (property, value) => {
      let og = document.querySelector(`meta[property="${property}"]`);
      if (!og) {
        og = document.createElement('meta');
        og.setAttribute('property', property);
        document.head.appendChild(og);
      }
      og.content = value;
    };
    setOg('og:title', title);
    setOg('og:description', a.excerpt);
    setOg('og:url', articleUrl);
    setOg('og:image', articleImage);
    setOg('og:type', 'article');

    // Dynamic NewsArticle JSON-LD Schema
    let articleSchema = document.getElementById('article-schema-ld');
    if (!articleSchema) {
      articleSchema = document.createElement('script');
      articleSchema.id = 'article-schema-ld';
      articleSchema.type = 'application/ld+json';
      document.head.appendChild(articleSchema);
    }
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": articleUrl
      },
      "headline": title,
      "description": a.excerpt,
      "image": articleImage,
      "datePublished": a.date + "T00:00:00+05:30",
      "dateModified": a.date + "T00:00:00+05:30",
      "author": {
        "@type": "Person",
        "name": a.author
      },
      "publisher": {
        "@type": "Organization",
        "name": "Gyanology",
        "logo": {
          "@type": "ImageObject",
          "url": `${currentOrigin}/data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>`
        }
      }
    };
    articleSchema.textContent = JSON.stringify(schemaData, null, 2);

    // Dynamic BreadcrumbList JSON-LD Schema
    let breadcrumbSchema = document.getElementById('breadcrumb-schema-ld');
    if (!breadcrumbSchema) {
      breadcrumbSchema = document.createElement('script');
      breadcrumbSchema.id = 'breadcrumb-schema-ld';
      breadcrumbSchema.type = 'application/ld+json';
      document.head.appendChild(breadcrumbSchema);
    }
    const breadcrumbData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": `${currentOrigin}/index.html`
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Articles",
          "item": `${currentOrigin}/articles.html`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": title,
          "item": articleUrl
        }
      ]
    };
    breadcrumbSchema.textContent = JSON.stringify(breadcrumbData, null, 2);

    this.generateTOC();
  },

  generateTOC() {
    const toc = document.getElementById('toc-list');
    if (!toc) return;
    const headings = document.querySelectorAll('#article-content h2, #article-content h3');
    if (headings.length === 0) { toc.closest('.sidebar-card')?.remove(); return; }
    toc.innerHTML = Array.from(headings).map((h, i) => {
      const id = `section-${i}`;
      h.id = id;
      const indent = h.tagName === 'H3' ? 'style="padding-left:12px;font-size:12px"' : '';
      return `<li><a href="#${id}" ${indent}>${h.textContent}</a></li>`;
    }).join('');
  },

  initReadingProgress() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;
    let completed = false;
    window.addEventListener('scroll', () => {
      const content = document.getElementById('article-content');
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const scrolled = Math.max(0, -rect.top);
      const total = content.offsetHeight - window.innerHeight;
      const pct = Math.min(100, total > 0 ? (scrolled / total) * 100 : 100);
      bar.style.width = pct + '%';

      if (pct > 90 && !completed) {
        completed = true;
        if (typeof DashboardManager !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const slug = params.get('slug');
          if (slug) {
            DashboardManager.markArticleRead(slug);
          }
        }
      }
    });
  },

  async loadRelated(category, currentSlug) {
    const data = await API.get(`/articles?category=${category}&limit=5`);
    if (!data) return;
    const related = data.filter(a => a.slug !== currentSlug).slice(0, 3);
    const container = document.getElementById('related-articles');
    if (!container || related.length === 0) return;
    container.innerHTML = related.map(a => `
      <div class="related-article" onclick="window.location.href='article.html?slug=${a.slug}'">
        <div class="related-emoji">${a.emoji}</div>
        <div class="related-info">
          <div class="related-cat">${a.category}</div>
          <div class="related-title">${a.title}</div>
        </div>
      </div>`).join('');
  }
};

// ===== CONTACT MANAGER =====
const ContactManager = {
  init() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('.form-submit');
      const origText = btn.textContent;
      btn.textContent = '⏳ Sending...';
      btn.disabled = true;

      const data = {
        name: form.name.value,
        email: form.email.value,
        subject: form.subject?.value || '',
        message: form.message.value
      };

      let emailSent = false;

      // 1️⃣ Try frontend EmailJS first (works without backend)
      if (typeof EmailJSService !== 'undefined' && EmailJSService.isReady()) {
        try {
          const emailResult = await EmailJSService.handleContact(data);
          emailSent = emailResult.success;
          if (emailSent) {
            console.log('✅ Emails sent via frontend EmailJS');
            console.log('   Admin notification:', emailResult.admin.success ? '✅' : '❌');
            console.log('   Auto-reply to user:', emailResult.reply.success ? '✅' : '❌');
          }
        } catch (err) {
          console.warn('⚠️ Frontend EmailJS failed:', err);
        }
      }

      // 2️⃣ Also save to backend (if available)
      let backendSaved = false;
      try {
        const result = await API.post('/contact', data);
        backendSaved = result && result.success;
      } catch (err) {
        console.warn('⚠️ Backend save failed (might be offline):', err);
      }

      // 3️⃣ Show result
      if (emailSent || backendSaved) {
        form.style.display = 'none';
        const msg = document.getElementById('success-msg');
        if (msg) {
          msg.style.display = 'block';
          // Update success message if auto-reply was sent
          if (emailSent) {
            const msgText = msg.querySelector('p');
            if (msgText) {
              msgText.textContent = `Thanks ${data.name.split(' ')[0]}! Your message has been received. A confirmation email has been sent to ${data.email} 📧`;
            }
          }
        }
      } else {
        showToast('❌ Kuch galat hua. Dobara try karein.', 'error');
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }
};

const AdminManager = {
  init() {
    const generateForm = document.getElementById('article-generator-form');
    const seedForm = document.getElementById('article-seed-form');
    const status = document.getElementById('admin-status');

    const updateStatus = (html) => {
      if (!status) return;
      status.innerHTML = html;
    };

    if (generateForm) {
      generateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('generate-title')?.value.trim();
        const category = document.getElementById('generate-category')?.value || 'gk';
        updateStatus('<p>Generating article…</p>');
        const result = await API.post('/generate-article', { title, category });
        if (result && result.success) {
          updateStatus(`<p>Article generated successfully.</p><p><strong>Title:</strong> ${result.article.title}</p><p><strong>Slug:</strong> ${result.article.slug}</p>`);
          return;
        }
        updateStatus('<p class="error-text">Article generation failed. Check the backend and try again.</p>');
      });
    }

    if (seedForm) {
      seedForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const count = Number(document.getElementById('seed-count')?.value) || 5;
        updateStatus('<p>Seeding articles…</p>');
        const result = await API.post('/seed-articles', { count });
        if (result && result.success) {
          updateStatus(`<p>Seeded ${result.count} articles successfully.</p><p>Refresh the articles page to see updated content.</p>`);
          return;
        }
        updateStatus('<p class="error-text">Seeding failed. Check the backend and try again.</p>');
      });
    }

    const importForm = document.getElementById('article-import-form');
    if (importForm) {
      importForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('import-url')?.value.trim();
        if (!url) {
          updateStatus('<p class="error-text">Please enter a valid URL.</p>');
          return;
        }
        updateStatus('<p>Importing articles from remote feed…</p>');
        const result = await API.post('/import-articles', { url });
        if (result && result.success) {
          updateStatus(`<p>Imported ${result.imported} articles successfully.</p><p>Refresh the articles page to view the new content.</p>`);
          return;
        }
        updateStatus('<p class="error-text">Import failed. Check the link and try again.</p>');
      });
    }
  }
};

// ===== NEWSLETTER MANAGER =====
const NewsletterManager = {
  init() {
    document.querySelectorAll('.newsletter-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('.newsletter-input');
        const email = input?.value;
        if (!email) return;
        const result = await API.post('/newsletter', { email });
        if (result && result.success) {
          showToast('✅ Newsletter subscribe ho gaye! Thank you.', 'success');
          if (input) input.value = '';
        } else {
          showToast('❌ Subscription fail ho gaya. Try again.', 'error');
        }
      });
    });
  }
};

// ===== COOKIE CONSENT BANNER =====
const CookieConsent = {
  init() {
    const choice = localStorage.getItem('bm-cookie-consent');
    if (!choice) {
      this.render();
    }
  },
  render() {
    const banner = document.createElement('div');
    banner.className = 'cookie-consent-banner';
    banner.innerHTML = `
      <div class="cookie-consent-text">
        We use cookies to personalize content and ads, to provide social media features and to analyze our traffic. We also share information about your use of our site with our advertising (Google AdSense) and analytics partners. View our <a href="privacy-policy.html">Privacy Policy</a> to learn more.
      </div>
      <div class="cookie-consent-buttons">
        <button class="cookie-btn-reject" id="cookie-reject">Reject</button>
        <button class="cookie-btn-accept" id="cookie-accept">Accept All</button>
      </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 1000);

    document.getElementById('cookie-accept')?.addEventListener('click', () => {
      localStorage.setItem('bm-cookie-consent', 'accept');
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 500);
    });

    document.getElementById('cookie-reject')?.addEventListener('click', () => {
      localStorage.setItem('bm-cookie-consent', 'reject');
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 500);
    });
  }
};

// ===== TEXT-TO-SPEECH (TTS) MANAGER =====
const TTSManager = {
  synth: window.speechSynthesis,
  utterance: null,
  isPlaying: false,

  init() {
    const playBtn = document.getElementById('tts-btn');
    const stopBtn = document.getElementById('tts-stop-btn');
    if (!playBtn) return;

    playBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.speak();
      }
    });

    stopBtn?.addEventListener('click', () => {
      this.stop();
    });
  },

  speak() {
    if (this.synth.paused && this.utterance) {
      this.synth.resume();
      this.isPlaying = true;
      this.updateUI();
      return;
    }

    this.stop();

    const contentEl = document.getElementById('article-content');
    if (!contentEl) return;

    // Extract readable text, remove script and styles
    const text = contentEl.innerText || contentEl.textContent;
    this.utterance = new SpeechSynthesisUtterance(text);

    // Auto-detect Hindi vs English language to pick correct voice direction
    const isHindi = document.getElementById('lang-hi')?.classList.contains('active');
    this.utterance.lang = isHindi ? 'hi-IN' : 'en-US';

    this.utterance.onend = () => {
      this.stop();
    };

    this.utterance.onerror = () => {
      this.stop();
    };

    this.synth.speak(this.utterance);
    this.isPlaying = true;
    this.updateUI();
  },

  pause() {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.isPlaying = false;
      this.updateUI();
    }
  },

  stop() {
    this.synth.cancel();
    this.isPlaying = false;
    this.utterance = null;
    this.updateUI();
  },

  updateUI() {
    const playBtn = document.getElementById('tts-btn');
    const stopBtn = document.getElementById('tts-stop-btn');
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸️ Pause' : '🔊 Listen';
      playBtn.classList.toggle('active', this.isPlaying);
    }
    if (stopBtn) {
      stopBtn.style.display = (this.isPlaying || this.synth.paused) ? 'inline-flex' : 'none';
    }
  }
};

// ===== FONT SIZE ADJUSTER =====
const FontAdjuster = {
  currentScale: 100,

  init() {
    const incBtn = document.getElementById('font-increase');
    const decBtn = document.getElementById('font-decrease');
    const rstBtn = document.getElementById('font-reset');
    const contentEl = document.getElementById('article-content');

    if (!contentEl) return;

    incBtn?.addEventListener('click', () => {
      if (this.currentScale < 140) {
        this.currentScale += 10;
        this.apply();
      }
    });

    decBtn?.addEventListener('click', () => {
      if (this.currentScale > 80) {
        this.currentScale -= 10;
        this.apply();
      }
    });

    rstBtn?.addEventListener('click', () => {
      this.currentScale = 100;
      this.apply();
    });
  },

  apply() {
    const contentEl = document.getElementById('article-content');
    if (contentEl) {
      contentEl.style.fontSize = `${this.currentScale}%`;
      contentEl.style.lineHeight = `${1.6 + (this.currentScale - 100) / 200}`;
    }
  }
};

// ===== BOOKMARK PAGE MANAGER (Single Article) =====
const BookmarkPageManager = {
  slug: null,

  init() {
    const btn = document.getElementById('bookmark-btn');
    if (!btn) return;

    const params = new URLSearchParams(window.location.search);
    this.slug = params.get('slug');
    if (!this.slug) return;

    this.updateUI();

    btn.addEventListener('click', () => {
      this.toggle();
    });
  },

  isBookmarked() {
    const bookmarks = JSON.parse(localStorage.getItem('bm-bookmarks') || '[]');
    return bookmarks.includes(this.slug);
  },

  toggle() {
    let bookmarks = JSON.parse(localStorage.getItem('bm-bookmarks') || '[]');
    if (this.isBookmarked()) {
      bookmarks = bookmarks.filter(s => s !== this.slug);
      showToast('🔖 Bookmark removed');
    } else {
      bookmarks.push(this.slug);
      showToast('🔖 Bookmark saved successfully!');
    }
    localStorage.setItem('bm-bookmarks', JSON.stringify(bookmarks));
    this.updateUI();
  },

  updateUI() {
    const btn = document.getElementById('bookmark-btn');
    if (!btn) return;
    if (this.isBookmarked()) {
      btn.textContent = '🔖 Saved';
      btn.classList.add('active');
    } else {
      btn.textContent = '🔖 Save';
      btn.classList.remove('active');
    }
  }
};

// ===== EMOJI REACTIONS =====
const ReactionManager = {
  slug: null,

  init() {
    const grid = document.getElementById('reactions-grid');
    if (!grid) return;

    const params = new URLSearchParams(window.location.search);
    this.slug = params.get('slug');
    if (!this.slug) return;

    this.loadReactions();

    grid.querySelectorAll('.reaction-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.reaction;
        this.react(type);
      });
    });
  },

  getStorageKey(type) {
    return `bm-reaction-${this.slug}-${type}`;
  },

  getGlobalKey(type) {
    return `bm-reaction-global-${this.slug}-${type}`;
  },

  loadReactions() {
    const types = ['helpful', 'loved', 'insightful', 'mindblown'];
    types.forEach(type => {
      // Local storage mock for reactions count
      const localCount = parseInt(localStorage.getItem(this.getGlobalKey(type)) || Math.floor(Math.random() * 20) + 5);
      // Save default value back if not existing
      if (!localStorage.getItem(this.getGlobalKey(type))) {
        localStorage.setItem(this.getGlobalKey(type), localCount);
      }
      
      const countEl = document.getElementById(`count-${type}`);
      if (countEl) countEl.textContent = localCount;

      const userReacted = localStorage.getItem(this.getStorageKey(type)) === 'true';
      const chip = document.querySelector(`.reaction-chip[data-reaction="${type}"]`);
      if (chip && userReacted) {
        chip.classList.add('reacted');
      }
    });
  },

  react(type) {
    const userReactedKey = this.getStorageKey(type);
    const globalCountKey = this.getGlobalKey(type);
    const userReacted = localStorage.getItem(userReactedKey) === 'true';
    let currentCount = parseInt(localStorage.getItem(globalCountKey) || '0');

    const chip = document.querySelector(`.reaction-chip[data-reaction="${type}"]`);
    if (!chip) return;

    if (userReacted) {
      currentCount = Math.max(0, currentCount - 1);
      localStorage.setItem(userReactedKey, 'false');
      chip.classList.remove('reacted');
      showToast('Removed reaction');
    } else {
      currentCount += 1;
      localStorage.setItem(userReactedKey, 'true');
      chip.classList.add('reacted');
      showToast('Reaction added! Thank you.');
    }

    localStorage.setItem(globalCountKey, currentCount);
    const countEl = document.getElementById(`count-${type}`);
    if (countEl) countEl.textContent = currentCount;
  }
};

// ===== AUTO-SUGGEST SEARCH =====
const AutoSuggestManager = {
  articles: [],

  async init() {
    // Cache articles
    const data = await API.get('/articles');
    this.articles = data || [];

    this.setupSuggest('hero-search-input', 'hero-suggest-dropdown');
    this.setupSuggest('search-input', 'articles-suggest-dropdown');
  },

  setupSuggest(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        dropdown.classList.remove('show');
        return;
      }

      const matches = this.articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.title_hi || '').toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q)
      ).slice(0, 5);

      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="suggest-item"><div class="suggest-title">No articles found</div></div>';
      } else {
        dropdown.innerHTML = matches.map(a => `
          <div class="suggest-item" data-slug="${a.slug}">
            <div class="suggest-emoji">${a.emoji || '📚'}</div>
            <div>
              <div class="suggest-title">${a.title}</div>
              <div class="suggest-cat">${a.category}</div>
            </div>
          </div>
        `).join('');
      }

      dropdown.classList.add('show');

      dropdown.querySelectorAll('.suggest-item').forEach(item => {
        item.addEventListener('click', () => {
          const slug = item.dataset.slug;
          if (slug) {
            window.location.href = `article.html?slug=${encodeURIComponent(slug)}`;
          }
        });
      });
    });

    // Close suggestion on click outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  }
};

// ===== VOICE SEARCH MANAGER =====
const VoiceSearchManager = {
  init() {
    this.setupVoice('hero-voice-btn', 'hero-search-input', () => {
      const form = document.getElementById('hero-search-form');
      if (form) {
        const query = document.getElementById('hero-search-input')?.value.trim();
        if (query) {
          window.location.href = `articles.html?search=${encodeURIComponent(query)}`;
        }
      }
    });
    this.setupVoice('articles-voice-btn', 'search-input', (val) => {
      if (typeof ArticlesManager !== 'undefined') {
        ArticlesManager.search(val);
      }
    });
  },

  setupVoice(btnId, inputId, callback) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btn.style.display = 'none';
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains('listening')) {
        rec.stop();
      } else {
        try {
          if (window.location.protocol === 'file:') {
            showToast('⚠️ Note: Voice Search requires a local web server (e.g. Live Server). It may not work on file://', 'error');
          }
          rec.start();
        } catch (err) {
          showToast('⚠️ Microphone access blocked or already in use.', 'error');
          btn.classList.remove('listening');
          btn.textContent = '🎤';
        }
      }
    });

    rec.onstart = () => {
      btn.classList.add('listening');
      btn.textContent = '🛑';
      showToast('🎤 Listening... Please speak now', 'info');
    };

    rec.onend = () => {
      btn.classList.remove('listening');
      btn.textContent = '🎤';
    };

    rec.onresult = (e) => {
      const result = e.results[0][0].transcript;
      input.value = result;
      showToast(`📝 Search query: "${result}"`, 'success');
      if (callback) callback(result);
    };

    rec.onerror = (e) => {
      console.error('Voice search error:', e.error);
      if (e.error === 'not-allowed') {
        showToast('⚠️ Please allow microphone access in your browser settings.', 'error');
      } else {
        showToast('⚠️ Voice input failed. Please try again.', 'error');
      }
      btn.classList.remove('listening');
      btn.textContent = '🎤';
    };
  }
};

// ===== REVISION NOTES COPY MANAGER =====
const NotesCopyManager = {
  init() {
    const btn = document.getElementById('copy-notes-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      this.copy();
    });
  },

  copy() {
    const title = document.getElementById('article-title')?.innerText || document.title;
    const contentEl = document.getElementById('article-content');
    if (!contentEl) return;

    let notesText = `📚 REVISION NOTES: ${title.toUpperCase()} 📚\n\n`;
    const elements = contentEl.querySelectorAll('h2, h3, .highlight-box, .fact-box, li');
    let count = 0;

    elements.forEach(el => {
      if (count > 25) return;
      const tag = el.tagName;
      if (tag === 'H2') {
        notesText += `\n📌 ${el.innerText}\n`;
      } else if (tag === 'H3') {
        notesText += `\n🔹 ${el.innerText}\n`;
      } else if (el.classList.contains('highlight-box') || el.classList.contains('fact-box')) {
        notesText += `⚡ Quick Tip/Fact: ${el.innerText}\n`;
        count++;
      } else if (tag === 'LI') {
        notesText += `• ${el.innerText}\n`;
        count++;
      }
    });

    notesText += `\n📖 For full details visit: ${window.location.href}`;

    navigator.clipboard.writeText(notesText).then(() => {
      showToast('📋 Revision notes copied to clipboard successfully!', 'success');
    }).catch(() => {
      showToast('❌ Failed to copy notes', 'error');
    });
  }
};

// ===== INTERACTIVE MCQ QUIZ MANAGER =====
const QuizManager = {
  questions: [],
  score: 0,
  answeredCount: 0,
  slug: null,

  quizData: {
    "what-is-photosynthesis": [
      { q: "Where does photosynthesis occur in plant cells?", o: ["Mitochondria", "Chloroplasts", "Ribosomes", "Nucleus"], a: 1 },
      { q: "Which pigment captures light energy and gives plants their green color?", o: ["Carotenoid", "Chlorophyll", "Hemoglobin", "Melanin"], a: 1 },
      { q: "What is released as a byproduct during photosynthesis?", o: ["Carbon Dioxide", "Nitrogen", "Oxygen", "Hydrogen"], a: 2 }
    ],
    "newtons-laws-of-motion": [
      { q: "Which law is known as the Law of Inertia?", o: ["First Law", "Second Law", "Third Law", "Law of Gravitation"], a: 0 },
      { q: "What is the formula representing Newton's Second Law?", o: ["F = m/a", "F = ma", "F = m + a", "W = mg"], a: 1 },
      { q: "Action and reaction forces act on which objects?", o: ["The same object", "Different objects", "No objects", "Depending on gravity"], a: 1 }
    ],
    "english-grammar-tenses": [
      { q: "Identify the tense: 'She has been studying for 2 hours.'", o: ["Present Perfect", "Present Continuous", "Present Perfect Continuous", "Simple Past"], a: 2 },
      { q: "What is the structure of the Simple Past tense?", o: ["Subject + V1", "Subject + V2", "Subject + had + V3", "Subject + V-ing"], a: 1 }
    ],
    "french-revolution": [
      { q: "Which estate paid all the taxes in pre-revolutionary France?", o: ["First Estate", "Second Estate", "Third Estate", "All estates equally"], a: 2 },
      { q: "What was the main slogan of the French Revolution?", o: ["Peace, Land, and Bread", "Liberty, Equality, Fraternity", "No taxation without representation", "Give me liberty or death"], a: 1 }
    ]
  },

  fallbackQuizzes: {
    school: [
      { q: "What is the smallest unit of life?", o: ["Tissue", "Organelle", "Cell", "Atom"], a: 2 },
      { q: "Which planet is known as the Red Planet?", o: ["Venus", "Mars", "Jupiter", "Saturn"], a: 1 }
    ],
    competitive: [
      { q: "Who was the first Prime Minister of India?", o: ["Mahatma Gandhi", "Dr. B.R. Ambedkar", "Jawaharlal Nehru", "Sardar Patel"], a: 2 },
      { q: "Which body of the Indian Constitution is responsible for holding elections?", o: ["UPSC", "Election Commission", "NITI Aayog", "Finance Commission"], a: 1 }
    ],
    gk: [
      { q: "What is the capital of India?", o: ["Mumbai", "Kolkata", "New Delhi", "Chennai"], a: 2 },
      { q: "Which is the largest ocean on Earth?", o: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"], a: 2 }
    ]
  },

  init(category) {
    const mount = document.getElementById('quiz-mount');
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    this.slug = params.get('slug');
    if (!this.slug) return;

    // Load custom questions, or fall back to category-based questions
    this.questions = this.quizData[this.slug] || this.fallbackQuizzes[category] || this.fallbackQuizzes.gk;
    this.score = 0;
    this.answeredCount = 0;

    this.render();
  },

  render() {
    const mount = document.getElementById('quiz-mount');
    if (!mount) return;

    let html = `
      <div class="quiz-container">
        <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;">🧠 Article Quick Quiz</h3>
    `;

    this.questions.forEach((q, qIndex) => {
      html += `
        <div class="quiz-question-box" data-qindex="${qIndex}">
          <div class="quiz-q-text">${qIndex + 1}. ${q.q}</div>
          <div class="quiz-options-list">
            ${q.o.map((opt, oIndex) => `
              <button class="quiz-opt-btn" onclick="QuizManager.checkAnswer(${qIndex}, ${oIndex}, this)">${opt}</button>
            `).join('')}
          </div>
        </div>
      `;
    });

    html += `
        <div class="quiz-footer">
          <div class="quiz-score-display" id="quiz-score-text">Answer the questions above!</div>
          <button class="action-btn-tool" onclick="QuizManager.resetQuiz()" style="font-size:12px;">Reset Quiz</button>
        </div>
      </div>
    `;

    mount.innerHTML = html;
  },

  checkAnswer(qIndex, oIndex, btn) {
    const qBox = btn.closest('.quiz-question-box');
    if (qBox.dataset.answered === "true") return;

    qBox.dataset.answered = "true";
    const correctIndex = this.questions[qIndex].a;
    const buttons = qBox.querySelectorAll('.quiz-opt-btn');

    buttons.forEach((b, idx) => {
      b.disabled = true;
      if (idx === correctIndex) {
        b.classList.add('correct');
      }
    });

    if (oIndex === correctIndex) {
      this.score++;
      showToast('🎉 Correct answer!', 'success');
      // Track quiz completion in dashboard
      if (typeof DashboardManager !== 'undefined') {
        DashboardManager.markQuizDone();
      }
    } else {
      btn.classList.add('incorrect');
      showToast('❌ Wrong answer. Try another question!', 'error');
    }

    this.answeredCount++;
    this.updateScoreUI();
  },

  updateScoreUI() {
    const text = document.getElementById('quiz-score-text');
    if (text) {
      text.textContent = `Score: ${this.score} / ${this.questions.length} answered`;
    }
  },

  resetQuiz() {
    this.score = 0;
    this.answeredCount = 0;
    this.render();
  }
};
window.QuizManager = QuizManager; // Expose globally for inline onclick handlers

// ===== SOCIAL SHARING ENHANCEMENT =====
const SocialShareManager = {
  init() {
    const wa = document.getElementById('share-whatsapp');
    const tw = document.getElementById('share-twitter');
    const ln = document.getElementById('share-linkedin');
    const fb = document.getElementById('share-facebook');
    if (!wa && !tw && !ln && !fb) return;

    setTimeout(() => {
      const title = document.getElementById('article-title')?.textContent || document.title;
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent(title);

      if (wa) wa.href = `https://api.whatsapp.com/send?text=${text}%20${url}`;
      if (tw) tw.href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
      if (ln) ln.href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
      if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    }, 1200);
  }
};

// ===== TOAST =====
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== FLOATING APP BANNER =====
const FloatingAppBanner = {
  init() {
    // Don't show if dismissed or on admin page
    if (localStorage.getItem('bm-app-banner-dismissed') === 'true' || document.body.dataset.page === 'admin') return;

    const banner = document.createElement('div');
    banner.className = 'floating-app-banner';
    banner.innerHTML = `
      <button class="app-banner-close" aria-label="Dismiss">&times;</button>
      <div class="app-banner-logo">📱</div>
      <div class="app-banner-info">
        <h4>Gyanology App is Live!</h4>
        <p>Learn offline with our free Android app.</p>
      </div>
      <a href="app/gyanology.apk" class="app-banner-download" download>Install APK</a>
    `;

    document.body.appendChild(banner);

    // Dismiss handling
    banner.querySelector('.app-banner-close').addEventListener('click', (e) => {
      e.stopPropagation();
      banner.classList.add('hide');
      localStorage.setItem('bm-app-banner-dismissed', 'true');
      setTimeout(() => banner.remove(), 400);
    });
  }
};

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  NavManager.init();
  CookieConsent.init();
  FloatingAppBanner.init();

  document.getElementById('theme-toggle')?.addEventListener('click', () => ThemeManager.toggle());

  const page = document.body.dataset.page;

  AutoSuggestManager.init();
  VoiceSearchManager.init();

  if (page === 'home') {
    HomeManager.init();
    
    // Homepage Hero Search handler
    const heroSearchForm = document.getElementById('hero-search-form');
    if (heroSearchForm) {
      heroSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('hero-search-input')?.value.trim();
        if (query) {
          window.location.href = `articles.html?search=${encodeURIComponent(query)}`;
        }
      });
    }

    // FAQ Accordion click toggles
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (question) {
        question.addEventListener('click', () => {
          const isActive = item.classList.contains('active');
          faqItems.forEach(i => {
            i.classList.remove('active');
            const ans = i.querySelector('.faq-answer');
            if (ans) ans.style.maxHeight = null;
          });
          if (!isActive) {
            item.classList.add('active');
            const ans = item.querySelector('.faq-answer');
            if (ans) ans.style.maxHeight = ans.scrollHeight + 'px';
          }
        });
      }
    });
  }

  if (page === 'articles') {
    ArticlesManager.init();
    document.getElementById('search-input')?.addEventListener('input', e => ArticlesManager.search(e.target.value));
    document.getElementById('search-clear')?.addEventListener('click', () => {
      const input = document.getElementById('search-input');
      if (input) { input.value = ''; ArticlesManager.search(''); input.focus(); }
    });
    document.querySelectorAll('[data-cat]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-cat]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ArticlesManager.filter(tab.dataset.cat);
      });
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ArticlesManager.currentLang = btn.dataset.lang;
        ArticlesManager.render();
      });
    });
  }

  if (page === 'article') {
    ArticleDetail.init();
    TTSManager.init();
    FontAdjuster.init();
    BookmarkPageManager.init();
    ReactionManager.init();
    SocialShareManager.init();
    FlashcardManager.init();
  }
  if (page === 'contact') ContactManager.init();
  if (page === 'admin') AdminManager.init();

  if (page === 'home') {
    DashboardManager.init();
    GoalPlannerManager.init();
  }

  NewsletterManager.init();
  GyanBotManager.init();
});

// ===== LEARNER DASHBOARD MANAGER =====
const DashboardManager = {
  storageKey: 'gyan-progress',

  init() {
    this.data = this.load();
    this.updateStreak();
    this.render();
  },

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || this.defaultData();
    } catch { return this.defaultData(); }
  },

  defaultData() {
    return {
      articlesRead: [],
      quizzesDone: 0,
      streak: 1,
      lastVisit: new Date().toDateString(),
      xp: 0,
      badges: []
    };
  },

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  },

  updateStreak() {
    const today = new Date().toDateString();
    const last = this.data.lastVisit;
    if (last !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (last === yesterday.toDateString()) {
        this.data.streak = (this.data.streak || 0) + 1;
      } else if (last !== today) {
        this.data.streak = 1;
      }
      this.data.lastVisit = today;
      this.save();
    }
  },

  markArticleRead(slug) {
    if (!this.data.articlesRead.includes(slug)) {
      this.data.articlesRead.push(slug);
      this.data.xp = (this.data.xp || 0) + 20;
      this.checkBadges();
      this.save();
      // Update goal planner
      if (typeof GoalPlannerManager !== 'undefined') GoalPlannerManager.markRead();
    }
  },

  markQuizDone() {
    this.data.quizzesDone = (this.data.quizzesDone || 0) + 1;
    this.data.xp = (this.data.xp || 0) + 30;
    this.checkBadges();
    this.save();
  },

  checkBadges() {
    const badges = this.data.badges || [];
    const read = this.data.articlesRead.length;
    const quizzes = this.data.quizzesDone;
    const newBadges = [];
    if (read >= 1 && !badges.includes('first-reader')) newBadges.push({ id: 'first-reader', icon: '📖', label: 'First Reader' });
    if (read >= 5 && !badges.includes('explorer')) newBadges.push({ id: 'explorer', icon: '🌟', label: 'Explorer' });
    if (read >= 10 && !badges.includes('scholar')) newBadges.push({ id: 'scholar', icon: '🎓', label: 'Scholar' });
    if (quizzes >= 1 && !badges.includes('quiz-starter')) newBadges.push({ id: 'quiz-starter', icon: '🎯', label: 'Quiz Starter' });
    if (quizzes >= 5 && !badges.includes('quiz-master')) newBadges.push({ id: 'quiz-master', icon: '🏆', label: 'Quiz Master' });
    if (this.data.streak >= 3 && !badges.includes('streak-3')) newBadges.push({ id: 'streak-3', icon: '🔥', label: '3-Day Streak' });
    if (this.data.streak >= 7 && !badges.includes('streak-7')) newBadges.push({ id: 'streak-7', icon: '⚡', label: '7-Day Legend' });
    newBadges.forEach(b => {
      this.data.badges = this.data.badges || [];
      this.data.badges.push(b.id);
      showToast(`🏅 Badge unlocked: ${b.icon} ${b.label}!`, 'success');
    });
  },

  render() {
    const d = this.data;
    const readEl = document.getElementById('stat-read');
    const quizEl = document.getElementById('stat-quizzes');
    const streakEl = document.getElementById('stat-streak');
    const xpEl = document.getElementById('user-xp');
    const badgesEl = document.getElementById('badges-container');

    if (readEl) readEl.textContent = d.articlesRead.length;
    if (quizEl) quizEl.textContent = d.quizzesDone;
    if (streakEl) streakEl.textContent = `🔥 ${d.streak}`;
    if (xpEl) xpEl.textContent = `${d.xp || 0} XP`;

    if (badgesEl) {
      const allBadges = [
        { id: 'first-reader', icon: '📖', label: 'First Reader' },
        { id: 'explorer', icon: '🌟', label: 'Explorer' },
        { id: 'scholar', icon: '🎓', label: 'Scholar' },
        { id: 'quiz-starter', icon: '🎯', label: 'Quiz Starter' },
        { id: 'quiz-master', icon: '🏆', label: 'Quiz Master' },
        { id: 'streak-3', icon: '🔥', label: '3-Day Streak' },
        { id: 'streak-7', icon: '⚡', label: '7-Day Legend' }
      ];
      const earned = d.badges || [];
      badgesEl.innerHTML = allBadges
        .filter(b => earned.includes(b.id))
        .map(b => `<span class="badge-chip earned">${b.icon} ${b.label}</span>`)
        .join('') ||
        `<span class="badge-chip">📚 Read articles to earn badges!</span>`;
    }
  }
};
window.DashboardManager = DashboardManager;

// ===== GOAL PLANNER MANAGER =====
const GoalPlannerManager = {
  storageKey: 'gyan-daily-goals',

  init() {
    this.loadState();
    this.render();
    this.bindEvents();
  },

  loadState() {
    const today = new Date().toDateString();
    const saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
    if (saved && saved.date === today) {
      this.target = saved.target;
      this.done = saved.done;
    } else {
      this.target = (saved && saved.target) ? saved.target : 3;
      this.done = 0;
    }
    this.date = today;
  },

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify({
      date: this.date,
      target: this.target,
      done: this.done
    }));
  },

  markRead() {
    if (this.done < this.target) {
      this.done++;
      this.save();
      this.render();
      if (this.done >= this.target) {
        showToast('🎉 Daily Goal Achieved! Amazing work!', 'success');
        if (typeof DashboardManager !== 'undefined') {
          DashboardManager.data.xp = (DashboardManager.data.xp || 0) + 50;
          DashboardManager.save();
          DashboardManager.render();
        }
      }
    }
  },

  render() {
    const pct = this.target > 0 ? Math.min(100, Math.round((this.done / this.target) * 100)) : 0;
    const bar = document.getElementById('goal-bar');
    const pctEl = document.getElementById('goal-percent');
    const targetEl = document.getElementById('goal-target');

    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (targetEl) targetEl.textContent = this.target;

    // Render checklist items
    const checklist = document.getElementById('goal-checklist-container');
    if (checklist) {
      checklist.innerHTML = Array.from({ length: this.target }, (_, i) => {
        const done = i < this.done;
        return `<div class="goal-checklist-item ${done ? 'checked' : ''}">
          <span class="goal-check-icon">${done ? '✅' : '⭕'}</span>
          <span>Article ${i + 1}</span>
        </div>`;
      }).join('');
    }
  },

  bindEvents() {
    document.getElementById('btn-inc-goal')?.addEventListener('click', () => {
      this.target = Math.min(10, this.target + 1);
      this.save();
      this.render();
    });
    document.getElementById('btn-dec-goal')?.addEventListener('click', () => {
      this.target = Math.max(1, this.target - 1);
      this.save();
      this.render();
    });
  }
};

// ===== FLASHCARD MANAGER =====
const FlashcardManager = {
  cards: [],
  currentIndex: 0,

  init() {
    this.buildCards();
    if (this.cards.length === 0) {
      const section = document.getElementById('flashcards-section');
      if (section) section.style.display = 'none';
      return;
    }
    this.renderCard();
    this.bindEvents();
  },

  buildCards() {
    // Build from article content h2/h3 headings + first paragraph text
    const content = document.getElementById('article-content');
    if (!content) return;
    const headings = content.querySelectorAll('h2, h3');
    headings.forEach(h => {
      const nextEl = h.nextElementSibling;
      const detail = nextEl && (nextEl.tagName === 'P' || nextEl.tagName === 'UL')
        ? nextEl.textContent.trim().slice(0, 180) + (nextEl.textContent.length > 180 ? '...' : '')
        : 'Read the article section for detailed explanation.';
      if (h.textContent.trim().length > 3) {
        this.cards.push({ term: h.textContent.trim(), detail });
      }
    });
    this.cards = this.cards.slice(0, 8); // Max 8 cards
  },

  renderCard() {
    const mount = document.getElementById('flashcard-mount');
    const counter = document.getElementById('flashcard-counter');
    if (!mount) return;

    const c = this.cards[this.currentIndex];
    mount.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <h4>${c.term}</h4>
          <span>👆 Tap to reveal</span>
        </div>
        <div class="flashcard-back">
          <p>${c.detail}</p>
        </div>
      </div>`;

    mount.classList.remove('flipped');
    if (counter) counter.textContent = `${this.currentIndex + 1} / ${this.cards.length}`;

    // Click to flip
    mount.onclick = () => mount.classList.toggle('flipped');
  },

  bindEvents() {
    document.getElementById('btn-prev-card')?.addEventListener('click', () => {
      this.currentIndex = (this.currentIndex - 1 + this.cards.length) % this.cards.length;
      this.renderCard();
    });
    document.getElementById('btn-next-card')?.addEventListener('click', () => {
      this.currentIndex = (this.currentIndex + 1) % this.cards.length;
      this.renderCard();
    });
  }
};

// ===== GYANBOT AI CHATBOT =====
const GyanBotManager = {
  init() {
    if (document.body.dataset.page === 'admin') return;

    this.renderWidget();
    this.bindEvents();
  },

  renderWidget() {
    const wrapper = document.createElement('div');
    wrapper.className = 'gyanbot-wrapper';
    wrapper.innerHTML = `
      <button class="gyanbot-toggle-btn" title="Ask GyanBot AI">💬</button>
      <div class="gyanbot-panel">
        <div class="gyanbot-header">
          <div class="gyanbot-header-info">
            <span class="gyanbot-avatar">🤖</span>
            <div class="gyanbot-header-text">
              <h4>GyanBot AI</h4>
              <span class="gyanbot-status">🟢 Online Tutor</span>
            </div>
          </div>
          <button class="gyanbot-close-btn">&times;</button>
        </div>
        <div class="gyanbot-messages" id="gyanbot-msg-container">
          <div class="gyanbot-msg gyanbot-msg-bot">
            Hello! I am <strong>GyanBot AI</strong>, your educational tutor. 📚
            <br><br>
            Aap mujhse school, competitive exams ya general knowledge ke baare mein kuch bhi puch sakte hain!
            <div class="gyanbot-suggestions">
              <button class="gyanbot-suggest-btn" data-q="What is Photosynthesis?">🌿 What is Photosynthesis?</button>
              <button class="gyanbot-suggest-btn" data-q="Newton's Laws of Motion">🍎 Newton's Laws of Motion</button>
              <button class="gyanbot-suggest-btn" data-q="Fundamental Rights in India">⚖️ Fundamental Rights in India</button>
            </div>
          </div>
        </div>
        <div class="gyanbot-input-area">
          <input type="text" class="gyanbot-input" placeholder="Ask GyanBot a question..." id="gyanbot-input-field">
          <button class="gyanbot-send-btn" id="gyanbot-send-btn">➔</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);
  },

  bindEvents() {
    const toggleBtn = document.querySelector('.gyanbot-toggle-btn');
    const panel = document.querySelector('.gyanbot-panel');
    const closeBtn = document.querySelector('.gyanbot-close-btn');
    const sendBtn = document.getElementById('gyanbot-send-btn');
    const inputField = document.getElementById('gyanbot-input-field');

    toggleBtn?.addEventListener('click', () => panel.classList.toggle('active'));
    closeBtn?.addEventListener('click', () => panel.classList.remove('active'));

    sendBtn?.addEventListener('click', () => this.handleSendMessage());
    inputField?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSendMessage();
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('gyanbot-suggest-btn')) {
        const query = e.target.dataset.q;
        if (query) {
          inputField.value = query;
          this.handleSendMessage();
        }
      }
    });
  },

  handleSendMessage() {
    const inputField = document.getElementById('gyanbot-input-field');
    const query = inputField.value.trim();
    if (!query) return;

    this.appendMessage(query, 'user');
    inputField.value = '';

    this.showTypingIndicator();

    setTimeout(() => {
      this.removeTypingIndicator();
      const response = this.generateResponse(query);
      this.appendMessage(response, 'bot');
    }, 1000);
  },

  appendMessage(text, sender) {
    const container = document.getElementById('gyanbot-msg-container');
    const msg = document.createElement('div');
    msg.className = `gyanbot-msg gyanbot-msg-${sender}`;
    msg.innerHTML = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  showTypingIndicator() {
    const container = document.getElementById('gyanbot-msg-container');
    const indicator = document.createElement('div');
    indicator.className = 'gyanbot-msg gyanbot-msg-bot';
    indicator.id = 'gyanbot-typing-indicator';
    indicator.innerHTML = `
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  },

  removeTypingIndicator() {
    const indicator = document.getElementById('gyanbot-typing-indicator');
    indicator?.remove();
  },

  generateResponse(query) {
    const q = query.toLowerCase();

    // Look inside window.GYANOLOGY_DATA if present
    const articles = (window.GYANOLOGY_DATA && window.GYANOLOGY_DATA.articles) || [];

    // Find best match in title or tags
    const matched = articles.find(a => 
      q.includes(a.title.toLowerCase()) || 
      a.title.toLowerCase().split(' ').some(word => word.length > 3 && q.includes(word)) ||
      (a.tags && a.tags.some(t => q.includes(t.toLowerCase())))
    );

    if (matched) {
      return `
        <strong>${matched.title}</strong> (${matched.category.toUpperCase()})
        <br><br>
        ${matched.excerpt}
        <br><br>
        📖 <a href="article.html?slug=${matched.slug}" style="color: var(--accent-indigo); font-weight:700;">Read full article here</a>
      `;
    }

    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      return "Hello! Main aapka AI study partner hoon. Aap mujhse kisi bhi educational topic ya revision notes ke baare mein pooch sakte hain. Try typing: <strong>Photosynthesis</strong> ya <strong>Newton</strong>.";
    }

    if (q.includes('help') || q.includes('what can you do') || q.includes('kaise')) {
      return "Main aapko Gyanology ke kisi bhi subject par notes read karwa sakta hoon aur quizzes ke sahi answer bata sakta hoon. Aap kisi bhi study topic ka naam search box mein likhein!";
    }

    return "Acha sawaal hai! Mujhe exact answer mere database mein nahi mila, lekin aap is topic ko website ke search bar mein search kar sakte hain. Aap ye topics seekh sakte hain: <strong>Photosynthesis</strong>, <strong>Newton's Laws</strong>, ya <strong>Fundamental Rights</strong>.";
  }
};

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
      hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
          mobileMenu.classList.remove('open');
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
    
    if (this.currentSearch) {
      const container = document.getElementById('articles-container');
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
      // Backend has already filtered by search term, we only filter by category locally.
      this.filtered = searchResults.filter(article => {
        return this.currentCategory === 'all' || article.category === this.currentCategory;
      });
    } else {
      searchResults = this.all;
      this.filtered = searchResults.filter(article => {
        const matchCat = this.currentCategory === 'all' || article.category === this.currentCategory;
        return matchCat;
      });
    }
    this.render();
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
    const endpoint = category === 'all' ? '/articles?limit=6' : `/articles?category=${category}&limit=6`;
    const data = await API.get(endpoint);
    const container = document.getElementById('featured-articles');
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
    window.addEventListener('scroll', () => {
      const content = document.getElementById('article-content');
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const scrolled = Math.max(0, -rect.top);
      const total = content.offsetHeight - window.innerHeight;
      bar.style.width = Math.min(100, total > 0 ? (scrolled / total) * 100 : 100) + '%';
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

  if (page === 'article') ArticleDetail.init();
  if (page === 'contact') ContactManager.init();
  if (page === 'admin') AdminManager.init();

  NewsletterManager.init();
});

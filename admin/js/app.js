function app() {
  return {
    // ── Auth ─────────────────────────────────────────────────────────────────
    token:      localStorage.getItem('zencrus_admin_token'),
    adminEmail: localStorage.getItem('zencrus_admin_email') ?? '',
    loginForm:  { email: '', password: '' },
    loginLoading: false,
    loginError: '',

    // ── Navigation ───────────────────────────────────────────────────────────
    page: 'dashboard',
    nav: [
      { id: 'dashboard',  label: 'Dashboard'    },
      { id: 'users',      label: 'Usuarios'     },
      { id: 'social',     label: 'Red Social'   },
      { id: 'content',    label: 'Contenido'    },
      { id: 'logs',       label: 'Registros'    },
      { id: 'subs',       label: 'Suscripciones'},
      { id: 'plans',      label: 'Planes'       },
    ],

    // ── State ────────────────────────────────────────────────────────────────
    loading: false,
    dash:    null,
    users:   [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    messages:    [],
    auditLogs:   [],
    activityLogs:[],
    subscriptions: [],
    revenue:    null,
    dietPlans:  [],
    socialPosts: [],

    // ── Filters ──────────────────────────────────────────────────────────────
    usersFilter:   { search: '', role: '', tier: '', status: '', page: 1 },
    contentFilter: { hasAttachment: false, search: '', page: 1 },
    subsFilter:    { status: '', tier: '', provider: '', page: 1 },
    logsFilter:    { page: 1 },
    logsTab:       'audit',
    socialFilter:  { type: '', flagged: false, page: 1 },

    // ── Panels ───────────────────────────────────────────────────────────────
    userPanel:     null,
    userPanelTab:  'info',
    deleteConfirm: null,
    newRole:       'user',

    // ── Toast ────────────────────────────────────────────────────────────────
    toast: '', toastType: 'success',

    // ── SSE ──────────────────────────────────────────────────────────────────
    sseConnected: false,
    liveEvents:   [],
    es:           null,

    // ─────────────────────────────────────────────────────────────────────────
    init() {
      if (this.token) {
        this.loadPage('dashboard')
        this.connectSSE()
      }
    },

    // ── API helper ───────────────────────────────────────────────────────────
    async api(path, opts = {}) {
      const res = await fetch(`/api/admin${path}`, {
        ...opts,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type':  'application/json',
          ...(opts.headers ?? {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      })
      if (res.status === 401) { this.logout(); return null }
      return res.json()
    },

    // ── Auth ─────────────────────────────────────────────────────────────────
    decodeJwt(token) {
      try {
        const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
        const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - b64.length % 4)
        return JSON.parse(atob(b64 + pad))
      } catch { return null }
    },

    async login() {
      this.loginLoading = true; this.loginError = ''
      try {
        const res  = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.loginForm),
        })
        const data = await res.json()
        if (!data.success) { this.loginError = data.message ?? 'Error al iniciar sesión'; return }
        const token   = data.data?.accessToken
        if (!token)   { this.loginError = 'No se recibió token'; return }
        const payload = this.decodeJwt(token)
        if (payload?.role !== 'admin') { this.loginError = 'Solo administradores pueden acceder'; return }
        this.token      = token
        this.adminEmail = payload.email ?? this.loginForm.email
        localStorage.setItem('zencrus_admin_token', this.token)
        localStorage.setItem('zencrus_admin_email', this.adminEmail)
        this.loadPage('dashboard')
        this.connectSSE()
      } catch { this.loginError = 'Error de conexión. Verifica que el servidor esté activo.' }
      finally  { this.loginLoading = false }
    },

    logout() {
      this.token     = null
      this.userPanel = null
      localStorage.removeItem('zencrus_admin_token')
      localStorage.removeItem('zencrus_admin_email')
      if (this.es) { this.es.close(); this.es = null }
    },

    // ── SSE ──────────────────────────────────────────────────────────────────
    connectSSE() {
      if (this.es) this.es.close()
      this.es = new EventSource(`/api/admin/stream?token=${this.token}`)
      this.es.onopen    = () => { this.sseConnected = true }
      this.es.onerror   = () => { this.sseConnected = false }
      this.es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data)
          if (ev.type === 'connected') return
          this.liveEvents.unshift(ev)
          if (this.liveEvents.length > 50) this.liveEvents.pop()
          if (ev.type === 'new_users'         && this.page === 'users')  this.loadUsers()
          if (ev.type === 'new_subscriptions' && this.page === 'subs')   this.loadSubs()
          if (ev.type === 'new_audit_logs'    && this.page === 'logs')   this.loadLogs()
        } catch {}
      }
    },

    // ── Page loader ──────────────────────────────────────────────────────────
    loadPage(p) {
      this.page = p
      if (p === 'dashboard') this.loadDash()
      if (p === 'users')     this.loadUsers()
      if (p === 'social')    this.loadSocialPosts()
      if (p === 'content')   this.loadContent()
      if (p === 'logs')      this.loadLogs()
      if (p === 'subs')      { this.loadSubs(); this.loadRevenue() }
      if (p === 'plans')     this.loadPlans()
    },

    // ── Dashboard ────────────────────────────────────────────────────────────
    async loadDash() {
      this.loading = true
      const res = await this.api('/dashboard')
      this.loading = false
      if (res?.success) {
        this.dash = res.data
        this.$nextTick(() => this.renderTierChart())
      }
    },

    renderTierChart() {
      const el = document.getElementById('tierChart')
      if (!el || !this.dash) return
      const existing = Chart.getChart(el)
      if (existing) existing.destroy()
      const tiers = this.dash.subscriptions.byTier ?? {}
      new Chart(el, {
        type: 'doughnut',
        data: {
          labels:   Object.keys(tiers),
          datasets: [{ data: Object.values(tiers), backgroundColor: ['#334155','#2563eb','#5b4fff','#059669'], borderWidth: 0 }],
        },
        options: {
          plugins: { legend: { labels: { color: '#94a3b8', font: { size: 12 } } } },
          cutout: '68%',
        },
      })
    },

    // ── Users ────────────────────────────────────────────────────────────────
    async loadUsers() {
      this.loading = true
      const { search, role, tier, status, page } = this.usersFilter
      const q = new URLSearchParams({
        page, limit: 20,
        ...(search && {search}), ...(role   && {role}),
        ...(tier   && {tier}),   ...(status && {status}),
      })
      const res = await this.api(`/users?${q}`)
      this.loading = false
      if (res?.success) { this.users = res.data ?? []; this.pagination = res.pagination }
    },

    async openUserPanel(u) {
      this.userPanelTab = 'info'
      this.userPanel    = { loading: true }
      const [detail, social] = await Promise.all([
        this.api(`/users/${u.id}`),
        this.api(`/users/${u.id}/social`).catch(() => null),
      ])
      if (detail?.success) {
        this.userPanel = {
          ...detail.data,
          socialStats: social?.data ?? { followers: 0, following: 0, postsTotal: 0, recentPosts: [] },
        }
        this.newRole = detail.data.user.role
      } else {
        this.userPanel = null
        this.showToast('Error cargando perfil', 'error')
      }
    },

    async toggleUser(u) {
      const res = await this.api(`/users/${u.id}/status`, {
        method: 'PATCH', body: { isActive: !u.is_active },
      })
      if (res?.success) { this.showToast(res.message); this.loadUsers() }
    },

    async changeRole(id) {
      const res = await this.api(`/users/${id}/role`, {
        method: 'PATCH', body: { role: this.newRole },
      })
      if (res?.success) {
        this.showToast(res.message)
        this.userPanel = null
        this.loadUsers()
      }
    },

    async unlockUserAction(id) {
      const res = await this.api(`/users/${id}/unlock`, { method: 'PATCH' })
      if (res?.success) this.showToast('Cuenta desbloqueada')
    },

    confirmDelete(u) { this.deleteConfirm = u; this.userPanel = null },

    async executeDelete() {
      const res = await this.api(`/users/${this.deleteConfirm.id}`, { method: 'DELETE' })
      this.deleteConfirm = null
      if (res?.success) { this.showToast(res.message); this.loadUsers() }
      else this.showToast(res?.message ?? 'Error al eliminar', 'error')
    },

    // ── Social ───────────────────────────────────────────────────────────────
    async loadSocialPosts() {
      this.loading = true
      const { type, flagged, page } = this.socialFilter
      const q = new URLSearchParams({
        page, limit: 20,
        ...(type    && {type}),
        ...(flagged && {flagged: 'true'}),
      })
      const res = await this.api(`/social/posts?${q}`)
      this.loading = false
      if (res?.success) { this.socialPosts = res.data ?? []; this.pagination = res.pagination }
    },

    async deleteSocialPost(id) {
      if (!confirm('¿Eliminar este post permanentemente?')) return
      const res = await this.api(`/social/posts/${id}`, { method: 'DELETE' })
      if (res?.success) { this.showToast('Post eliminado'); this.loadSocialPosts() }
      else this.showToast(res?.message ?? 'Error', 'error')
    },

    // ── Pagination helpers ────────────────────────────────────────────────────
    prevPage(section) {
      const f = this._filterFor(section)
      if (f && f.page > 1) { f.page--; this._reloadSection(section) }
    },
    nextPage(section) {
      const f = this._filterFor(section)
      if (f && f.page < this.pagination.totalPages) { f.page++; this._reloadSection(section) }
    },
    _filterFor(s) {
      return { users: this.usersFilter, content: this.contentFilter, subs: this.subsFilter, logs: this.logsFilter, social: this.socialFilter }[s] ?? null
    },
    _reloadSection(s) {
      if (s === 'users')   this.loadUsers()
      if (s === 'content') this.loadContent()
      if (s === 'subs')    this.loadSubs()
      if (s === 'logs')    this.logsTab === 'activity' ? this.loadActivity() : this.loadLogs()
      if (s === 'social')  this.loadSocialPosts()
    },

    // ── Content ──────────────────────────────────────────────────────────────
    async loadContent() {
      this.loading = true
      const { hasAttachment, search, page } = this.contentFilter
      const q = new URLSearchParams({ page, limit: 20, ...(hasAttachment && {hasAttachment:'true'}), ...(search && {search}) })
      const res = await this.api(`/content/messages?${q}`)
      this.loading = false
      if (res?.success) { this.messages = res.data ?? []; this.pagination = res.pagination }
    },

    async deleteMsg(id) {
      if (!confirm('¿Eliminar este mensaje?')) return
      const res = await this.api(`/content/messages/${id}`, { method: 'DELETE' })
      if (res?.success) { this.showToast('Mensaje eliminado'); this.loadContent() }
    },

    // ── Logs ─────────────────────────────────────────────────────────────────
    async loadLogs() {
      this.loading = true
      const q = new URLSearchParams({ page: this.logsFilter.page, limit: 50 })
      const res = await this.api(`/logs/audit?${q}`)
      this.loading = false
      if (res?.success) { this.auditLogs = res.data ?? []; this.pagination = res.pagination }
    },

    async loadActivity() {
      this.loading = true
      const q = new URLSearchParams({ page: this.logsFilter.page, limit: 50 })
      const res = await this.api(`/logs/activity?${q}`)
      this.loading = false
      if (res?.success) { this.activityLogs = res.data ?? []; this.pagination = res.pagination }
    },

    // ── Subscriptions ─────────────────────────────────────────────────────────
    async loadSubs() {
      this.loading = true
      const { status, tier, provider, page } = this.subsFilter
      const q = new URLSearchParams({ page, limit: 20, ...(status && {status}), ...(tier && {tier}), ...(provider && {provider}) })
      const res = await this.api(`/subscriptions?${q}`)
      this.loading = false
      if (res?.success) { this.subscriptions = res.data ?? []; this.pagination = res.pagination }
    },

    async loadRevenue() {
      const res = await this.api('/subscriptions/revenue')
      if (res?.success) this.revenue = res.data
    },

    // ── Plans ─────────────────────────────────────────────────────────────────
    async loadPlans() {
      this.loading = true
      const res = await this.api('/plans/diet?page=1&limit=50')
      this.loading = false
      if (res?.success) { this.dietPlans = res.data ?? []; this.pagination = res.pagination }
    },

    async deletePlan(id) {
      if (!confirm('¿Eliminar este plan?')) return
      const res = await this.api(`/plans/diet/${id}`, { method: 'DELETE' })
      if (res?.success) { this.showToast('Plan eliminado'); this.loadPlans() }
    },

    // ── Toast ─────────────────────────────────────────────────────────────────
    showToast(msg, type = 'success') {
      this.toast = msg; this.toastType = type
      setTimeout(() => { this.toast = '' }, 3200)
    },

    // ── Formatters ────────────────────────────────────────────────────────────
    fmt(d)     { return d ? new Date(d).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }) : '—' },
    fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-MX') : '—' },
    fmtRel(d)  {
      if (!d) return '—'
      const diff = Date.now() - new Date(d).getTime()
      const m = Math.floor(diff / 60000)
      if (m < 1)  return 'Ahora'
      if (m < 60) return `${m}m`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h}h`
      return `${Math.floor(h / 24)}d`
    },
    tierBadge(t) {
      return { free:'bdg-slate', basic:'bdg-blue', premium:'bdg-purple', corporate:'bdg-amber' }[t] ?? 'bdg-slate'
    },
    roleBadge(r) {
      return { user:'bdg-slate', admin:'bdg-red', nutritionist:'bdg-green' }[r] ?? 'bdg-slate'
    },
    statusBadge(s) {
      return { active:'bdg-green', expired:'bdg-slate', cancelled:'bdg-red', pending:'bdg-amber' }[s] ?? 'bdg-slate'
    },
    actionBadge(a) {
      if (!a) return 'bdg-slate'
      if (a.includes('fail') || a.includes('suspicious') || a.includes('delete') || a.includes('unauthorized')) return 'bdg-red'
      if (a.includes('login'))    return 'bdg-blue'
      if (a.includes('register')) return 'bdg-green'
      if (a.includes('admin'))    return 'bdg-amber'
      return 'bdg-slate'
    },
    avatar(url) { return url || '/admin/img/avatar.svg' },
  }
}

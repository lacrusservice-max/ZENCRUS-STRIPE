function app() {
  return {
    // ── Auth ────────────────────────────────────────────────────────────────
    token:      localStorage.getItem('zencrus_admin_token') || null,
    adminEmail: localStorage.getItem('zencrus_admin_email') || '',
    loginForm:  { email: '', password: '' },
    loginLoading: false,
    loginError:   '',

    // ── Navigation ──────────────────────────────────────────────────────────
    page: 'dashboard',
    nav: [
      { id: 'dashboard',     label: 'Dashboard' },
      { id: 'users',         label: 'Usuarios' },
      { id: 'subs',          label: 'Suscripciones' },
      { id: 'trials',        label: 'Períodos de prueba' },
      { id: 'revenue',       label: 'Ingresos' },
      { id: 'analytics',     label: 'Analíticas' },
      { id: 'notifications', label: 'Notificaciones' },
      { id: 'social',        label: 'Red Social' },
      { id: 'content',       label: 'Contenido' },
      { id: 'logs',          label: 'Registros' },
      { id: 'plans',         label: 'Planes dieta' },
    ],

    // ── SSE ─────────────────────────────────────────────────────────────────
    es:           null,
    sseConnected: false,
    liveEvents:   [],

    // ── Loading ──────────────────────────────────────────────────────────────
    loading: false,

    // ── Data ────────────────────────────────────────────────────────────────
    dash:         null,
    users:        [],
    subscriptions:[],
    trials:       [],
    revenue:      null,
    analytics:    null,
    dietPlans:    [],
    socialPosts:  [],
    messages:     [],
    auditLogs:    [],
    activityLogs: [],
    logsTab:      'audit',

    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },

    usersFilter:   { search: '', role: '', tier: '', status: '', page: 1 },
    contentFilter: { hasAttachment: false, search: '', page: 1 },
    subsFilter:    { status: '', tier: '', provider: '', page: 1 },
    trialsFilter:  { page: 1 },
    logsFilter:    { page: 1 },
    socialFilter:  { type: '', flagged: false, page: 1 },

    // ── Panels & Modals ──────────────────────────────────────────────────────
    userPanel:     null,
    userPanelTab:  'info',
    newRole:       'user',
    deleteConfirm: null,

    extendModal:   null,
    extendDays:    7,

    notifyTarget:  null,
    notifyForm:    { subject: '', message: '', tierFilter: '' },
    notifyLoading: false,

    toast:     '',
    toastType: 'success',

    // ── Init ────────────────────────────────────────────────────────────────
    init() {
      if (this.token) {
        this.loadPage('dashboard')
        this.connectSSE()
        this.loadAnalytics()
      }
    },

    // ── API helper ──────────────────────────────────────────────────────────
    async api(path, opts = {}) {
      try {
        const res = await fetch(`/api/admin${path}`, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          },
          method: opts.method || 'GET',
          body:   opts.body ? JSON.stringify(opts.body) : undefined,
        })
        if (res.status === 401) { this.logout(); return null }
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('csv') || ct.includes('octet')) return res
        return await res.json()
      } catch { return null }
    },

    decodeJwt(token) {
      try {
        return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      } catch { return null }
    },

    // ── Auth ────────────────────────────────────────────────────────────────
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
        this.loadAnalytics()
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
          this.liveEvents.unshift({ ...ev, ts: ev.ts || Date.now() })
          if (this.liveEvents.length > 100) this.liveEvents.pop()

          if (ev.type === 'new_users') {
            const u = ev.payload?.[0]
            if (u) this.showToast(`Nuevo registro: ${u.email}`, 'info')
            if (this.page === 'users')     this.loadUsers()
            if (this.page === 'dashboard') this.loadDash()
          }
          if (ev.type === 'new_subscriptions') {
            if (this.page === 'subs')   this.loadSubs()
            if (this.page === 'trials') this.loadTrials()
          }
          if (ev.type === 'new_audit_logs' && this.page === 'logs') this.loadLogs()
        } catch {}
      }
    },

    // ── Page loader ──────────────────────────────────────────────────────────
    loadPage(p) {
      this.page = p
      if (p === 'dashboard')     this.loadDash()
      if (p === 'users')         this.loadUsers()
      if (p === 'social')        this.loadSocialPosts()
      if (p === 'content')       this.loadContent()
      if (p === 'logs')          this.loadLogs()
      if (p === 'subs')          { this.loadSubs(); this.loadRevenue() }
      if (p === 'trials')        this.loadTrials()
      if (p === 'revenue')       this.loadRevenue()
      if (p === 'analytics')     this.loadAnalytics()
      if (p === 'plans')         this.loadPlans()
    },

    // ── Dashboard ────────────────────────────────────────────────────────────
    async loadDash() {
      this.loading = true
      const res = await this.api('/dashboard')
      this.loading = false
      if (res?.success) {
        this.dash = res.data
        this.$nextTick(() => { this.renderTierChart(); this.renderRecentRegChart() })
      }
    },

    renderTierChart() {
      const el = document.getElementById('tierChart')
      if (!el || !this.dash) return
      const existing = Chart.getChart(el)
      if (existing) existing.destroy()
      const tiers = this.dash.subscriptions.byTier ?? {}
      const labels = Object.keys(tiers)
      if (labels.length === 0) return
      new Chart(el, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data: Object.values(tiers), backgroundColor: ['#334155','#2563eb','#5b4fff','#059669'], borderWidth: 0 }],
        },
        options: {
          plugins: { legend: { labels: { color: '#94a3b8', font: { size: 12 } } } },
          cutout: '68%',
        },
      })
    },

    renderRecentRegChart() {
      const el = document.getElementById('recentRegChart')
      if (!el || !this.analytics) return
      const existing = Chart.getChart(el)
      if (existing) existing.destroy()
      const labels = Object.keys(this.analytics.registrationsPerDay || {}).slice(-14).map(d => d.slice(5))
      const data   = Object.values(this.analytics.registrationsPerDay || {}).slice(-14)
      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Registros', data, backgroundColor: 'rgba(91,79,255,.65)', borderRadius: 5 }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
            y: { ticks: { color: '#64748b', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,.04)' } },
          },
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

    async exportUsersCSV() {
      const res = await this.api('/export/users')
      if (!res) { this.showToast('Error al exportar', 'error'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `zencrus-usuarios-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      this.showToast('Archivo CSV descargado')
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
      if (res?.success) {
        this.revenue = res.data
        this.$nextTick(() => this.renderRevenueChart())
      }
    },

    renderRevenueChart() {
      const el = document.getElementById('revenueChart')
      if (!el || !this.revenue) return
      const existing = Chart.getChart(el)
      if (existing) existing.destroy()
      const tiers  = this.revenue.byTier ?? {}
      const labels = Object.keys(tiers)
      if (labels.length === 0) return
      const prices = this.revenue.prices ?? {}
      const revs   = labels.map(t => (tiers[t] ?? 0) * (prices[t] ?? 0))
      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Usuarios activos', data: Object.values(tiers), backgroundColor: 'rgba(91,79,255,.6)', borderRadius: 6, yAxisID: 'y' },
            { label: 'Ingresos $MXN', data: revs, backgroundColor: 'rgba(52,211,153,.6)', borderRadius: 6, yAxisID: 'y1' },
          ],
        },
        options: {
          plugins: { legend: { labels: { color: '#94a3b8', font: { size: 12 } } } },
          scales: {
            x:  { ticks: { color: '#64748b' }, grid: { display: false } },
            y:  { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.04)' }, position: 'left' },
            y1: { ticks: { color: '#34d399' }, grid: { display: false }, position: 'right' },
          },
        },
      })
    },

    // ── Trials ────────────────────────────────────────────────────────────────
    async loadTrials() {
      this.loading = true
      const { page } = this.trialsFilter
      const res = await this.api(`/subscriptions/trials?page=${page}&limit=20`)
      this.loading = false
      if (res?.success) { this.trials = res.data ?? []; this.pagination = res.pagination }
    },

    openExtendModal(sub) { this.extendModal = sub; this.extendDays = 7 },

    async doExtend() {
      const res = await this.api(`/subscriptions/${this.extendModal.id}/extend`, {
        method: 'PATCH', body: { days: Number(this.extendDays) },
      })
      this.extendModal = null
      if (res?.success) { this.showToast(res.message); this.loadTrials() }
      else this.showToast(res?.message ?? 'Error', 'error')
    },

    async cancelSubAdmin(id) {
      if (!confirm('¿Cancelar esta suscripción? El usuario pasará a plan Free.')) return
      const res = await this.api(`/subscriptions/${id}/cancel`, { method: 'PATCH' })
      if (res?.success) { this.showToast(res.message); this.loadSubs(); this.loadTrials() }
      else this.showToast(res?.message ?? 'Error', 'error')
    },

    // ── Analytics ─────────────────────────────────────────────────────────────
    async loadAnalytics() {
      const res = await this.api('/analytics')
      if (res?.success) {
        this.analytics = res.data
        if (this.page === 'analytics') {
          this.$nextTick(() => { this.renderRegistrationChart(); this.renderSubsChart() })
        }
        if (this.page === 'dashboard') {
          this.$nextTick(() => this.renderRecentRegChart())
        }
      }
    },

    renderRegistrationChart() {
      const el = document.getElementById('registrationChart')
      if (!el || !this.analytics) return
      const existing = Chart.getChart(el)
      if (existing) existing.destroy()
      const labels = Object.keys(this.analytics.registrationsPerDay || {}).map(d => d.slice(5))
      const data   = Object.values(this.analytics.registrationsPerDay || {})
      new Chart(el, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Registros diarios',
            data,
            borderColor: '#5b4fff',
            backgroundColor: 'rgba(91,79,255,.12)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#5b4fff',
          }],
        },
        options: {
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { display: false } },
            y: { ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(255,255,255,.04)' } },
          },
        },
      })
    },

    renderSubsChart() {
      const el = document.getElementById('subsAnalyticsChart')
      if (!el || !this.analytics) return
      const existing = Chart.getChart(el)
      if (existing) existing.destroy()
      const labels = Object.keys(this.analytics.subsPerDay || {}).map(d => d.slice(5))
      const data   = Object.values(this.analytics.subsPerDay || {})
      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Nuevas suscripciones',
            data,
            backgroundColor: 'rgba(52,211,153,.6)',
            borderRadius: 5,
          }],
        },
        options: {
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { display: false } },
            y: { ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(255,255,255,.04)' } },
          },
        },
      })
    },

    // ── Notifications ──────────────────────────────────────────────────────────
    openNotifyModal(u) {
      this.notifyTarget = u
      this.notifyForm   = { subject: '', message: '', tierFilter: '' }
    },

    async sendNotifyToUser() {
      if (!this.notifyForm.subject.trim() || !this.notifyForm.message.trim()) {
        this.showToast('Completa asunto y mensaje', 'error'); return
      }
      this.notifyLoading = true
      const res = await this.api(`/notify/user/${this.notifyTarget.id}`, {
        method: 'POST',
        body: { subject: this.notifyForm.subject, message: this.notifyForm.message },
      })
      this.notifyLoading = false
      if (res?.success) { this.showToast(res.message); this.notifyTarget = null }
      else this.showToast(res?.message ?? 'Error', 'error')
    },

    async sendNotifyToAll() {
      if (!this.notifyForm.subject.trim() || !this.notifyForm.message.trim()) {
        this.showToast('Completa asunto y mensaje', 'error'); return
      }
      if (!confirm(`¿Enviar correo masivo a todos los usuarios${this.notifyForm.tierFilter ? ' con plan ' + this.notifyForm.tierFilter : ''}?`)) return
      this.notifyLoading = true
      const res = await this.api('/notify/all', {
        method: 'POST',
        body: { subject: this.notifyForm.subject, message: this.notifyForm.message, tierFilter: this.notifyForm.tierFilter || undefined },
      })
      this.notifyLoading = false
      if (res?.success) { this.showToast(res.message); this.notifyForm = { subject: '', message: '', tierFilter: '' } }
      else this.showToast(res?.message ?? 'Error', 'error')
    },

    // ── Social ───────────────────────────────────────────────────────────────
    async loadSocialPosts() {
      this.loading = true
      const { type, flagged, page } = this.socialFilter
      const q = new URLSearchParams({ page, limit: 20, ...(type && {type}), ...(flagged && {flagged:'true'}) })
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
      return { users: this.usersFilter, content: this.contentFilter, subs: this.subsFilter, logs: this.logsFilter, social: this.socialFilter, trials: this.trialsFilter }[s] ?? null
    },
    _reloadSection(s) {
      if (s === 'users')   this.loadUsers()
      if (s === 'content') this.loadContent()
      if (s === 'subs')    this.loadSubs()
      if (s === 'trials')  this.loadTrials()
      if (s === 'logs')    this.logsTab === 'activity' ? this.loadActivity() : this.loadLogs()
      if (s === 'social')  this.loadSocialPosts()
    },

    // ── Toast ─────────────────────────────────────────────────────────────────
    showToast(msg, type = 'success') {
      this.toast = msg; this.toastType = type
      setTimeout(() => { this.toast = '' }, 3500)
    },

    // ── Trial helpers ─────────────────────────────────────────────────────────
    trialDaysLeft(endDate) {
      if (!endDate) return 0
      return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 864e5))
    },

    trialDaysColor(endDate) {
      const d = this.trialDaysLeft(endDate)
      if (d === 0) return '#f87171'
      if (d <= 1)  return '#fb923c'
      if (d <= 3)  return '#fbbf24'
      return '#34d399'
    },

    // ── Formatters ────────────────────────────────────────────────────────────
    fmt(d)     { return d ? new Date(d).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' }) : '—' },
    fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-MX') : '—' },
    fmtMoney(n){ return n != null ? `$${Number(n).toLocaleString('es-MX')} MXN` : '—' },
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
    tierBadge(t)     { return { free:'bdg-slate', basic:'bdg-blue', premium:'bdg-purple', corporate:'bdg-amber' }[t] ?? 'bdg-slate' },
    roleBadge(r)     { return { user:'bdg-slate', admin:'bdg-red', nutritionist:'bdg-green' }[r] ?? 'bdg-slate' },
    statusBadge(s)   { return { active:'bdg-green', expired:'bdg-slate', cancelled:'bdg-red', pending:'bdg-amber' }[s] ?? 'bdg-slate' },
    providerBadge(p) { return { stripe:'bdg-blue', mercadopago:'bdg-green', none:'bdg-slate' }[p] ?? 'bdg-slate' },
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

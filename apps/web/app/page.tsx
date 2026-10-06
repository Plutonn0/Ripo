export default function HomePage() {
  const guilds = [
    { name: 'Ripo Dev', id: '1', installed: true },
    { name: 'Community Hub', id: '2', installed: false },
    { name: 'Game Lounge', id: '3', installed: true },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-6">
        <header className="mb-6 flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Guild management</p>
            <h1 className="text-2xl font-semibold">Ripo Dashboard</h1>
          </div>
          <button className="rounded-md border border-brand-500 bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            Discord Login
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {guilds.map((guild) => (
            <div key={guild.id} className="panel">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-lg">{guild.name}</div>
                  <div className="text-sm text-slate-400">{guild.installed ? 'Ripo installed' : 'Not installed'}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${guild.installed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                  {guild.installed ? 'Manage Server' : 'Add Ripo'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-700 pt-3 text-sm text-slate-300">
                <span>Prefix</span>
                <span className="font-mono">?</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

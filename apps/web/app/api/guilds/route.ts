export async function GET() {
  return Response.json({
    guilds: [
      { id: '1', name: 'Ripo Dev', installed: true },
      { id: '2', name: 'Community Hub', installed: false },
      { id: '3', name: 'Game Lounge', installed: true },
    ],
  });
}

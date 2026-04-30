export default function DashboardLoading() {
  return (
    <div className="flex-1 w-full h-[80vh] flex flex-col items-center justify-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-sky-700 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-gray-500 font-['Space_Grotesk'] font-medium animate-pulse">
        Fetching data from portal...
      </p>
    </div>
  );
}

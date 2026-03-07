export default function TimerSkeleton() {
  return (
    <div className="border-2 border-blue-100 rounded-lg w-96 shadow shadow-blue-200 my-4">
      <div className="animate-pulse">
        <div className="rounded-md bg-slate-700 h-24 w-auto my-4 mx-8"></div>
        <div className="flex flex-row justify-evenly mx-8">
          <div className="h-20 w-20 bg-slate-700 rounded-full"></div>
          <div className="h-20 w-20 bg-slate-700 rounded-full"></div>
          <div className="h-20 w-20 bg-slate-700 rounded-full"></div>
        </div>
        <div className="h-8 bg-slate-700 rounded-md w-auto my-4 mx-8"></div>
        <div className="h-4 bg-slate-700 rounded-md w-auto my-4 mx-8"></div>
        <div className="h-4 bg-slate-700 rounded-md w-auto my-4 mx-8"></div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function OAuthRedirect() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");

  useEffect(() => {
    if (url) {
      window.location.href = url;
    }
  }, [url]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0A0612] text-white">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mb-4" />
      <p className="text-white/70">Redirecting to login provider...</p>
      {url && (
        <a href={url} className="mt-4 text-sm text-purple-400 hover:underline">
          Click here if you are not redirected automatically.
        </a>
      )}
    </div>
  );
}

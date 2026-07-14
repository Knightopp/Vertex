import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/layout/Layout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <Layout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-5xl font-extrabold text-white">404</h1>
        <p className="text-xl text-white/60">Oops! Page not found</p>
        <Link
          to="/"
          className="text-lg font-medium text-accent hover:opacity-80"
        >
          Return to Home
        </Link>
      </div>
    </Layout>
  );
};

export default NotFound;

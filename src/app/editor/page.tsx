"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Puck, Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { puckConfig } from "@/puck/config";
import { supabase } from "@/lib/supabase";

// Default page data with InnovaKine's standard layout
const defaultData: Data = {
  root: { props: {} },
  content: [
    { type: "HeroBlock", props: { id: "hero-1" } },
    { type: "AboutBlock", props: { id: "about-1" } },
    { type: "ServicesBlock", props: { id: "services-1" } },
    { type: "TeamBlock", props: { id: "team-1" } },
    { type: "ReviewsBlock", props: { id: "reviews-1" } },
    { type: "LocationBlock", props: { id: "location-1" } },
    { type: "FAQBlock", props: { id: "faq-1" } },
    { type: "BookingFormBlock", props: { id: "booking-1" } },
    { type: "InstagramFeedBlock", props: { id: "instagram-1" } },
    { type: "FooterBlock", props: { id: "footer-1" } },
  ],
};

export default function EditorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<Data>(defaultData);
  const [saveStatus, setSaveStatus] = useState<string>("");

  // Check auth on mount — same pattern as admin layout
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  // Load saved page data
  useEffect(() => {
    async function loadPageData() {
      try {
        const res = await fetch("/api/puck?page=home");
        if (res.ok) {
          const data = await res.json();
          if (data?.content) {
            setPageData(data);
          }
        }
      } catch {
        console.log("No saved page data found, using defaults");
      }
    }
    if (!loading) loadPageData();
  }, [loading]);

  // Save handler
  const handleSave = useCallback(async (data: Data) => {
    setSaveStatus("Guardando...");
    try {
      const res = await fetch("/api/puck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "home", data }),
      });

      if (res.ok) {
        setSaveStatus("\u2705 \u00a1Guardado exitosamente!");
      } else {
        const err = await res.json();
        setSaveStatus(`\u274c Error: ${err.error || "No se pudo guardar"}`);
      }
    } catch {
      setSaveStatus("\u274c Error de conexi\u00f3n");
    }

    setTimeout(() => setSaveStatus(""), 3000);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Cargando editor...</p>
        </div>
      </div>
    );
  }

  // Editor
  return (
    <div className="relative">
      {saveStatus && (
        <div className="fixed top-4 right-4 z-[9999] px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg font-medium text-sm">
          {saveStatus}
        </div>
      )}
      <Puck
        config={puckConfig}
        data={pageData}
        onPublish={handleSave}
        headerTitle="InnovaKine \u2014 Editor Visual"
      />
    </div>
  );
}

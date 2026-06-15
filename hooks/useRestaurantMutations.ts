"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { compressImageFile } from "@/lib/compress-image";
import type { DashboardRestaurant } from "@/components/dashboard/types";
import type { OeffnungszeitenWoche } from "@/lib/supabase";

type Patch = {
  adresse?: string | null;
  telefon?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  maps_url?: string | null;
  oeffnungszeiten?: OeffnungszeitenWoche | null;
  active_languages?: string[];
  wifi_name?: string | null;
  wifi_password?: string | null;
  kitchen_closes_at?: string | null;
};

type Args = {
  restaurant: DashboardRestaurant;
  onRestaurantChange: (next: DashboardRestaurant) => void;
  onToast: (msg: string) => void;
};

/** Bündelt Logo-Upload, Splash-Upload und Restaurant-Patches.
 *  Verwendet von SettingsPage und DashboardApp (Logo-Upload-Banner). */
export function useRestaurantMutations({ restaurant, onRestaurantChange, onToast }: Args) {
  const router = useRouter();
  const [logoPreview, setLogoPreview] = useState<string | null>(restaurant.logo_url ?? null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(restaurant.logo_url ?? null);
  const [extracting, setExtracting] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);
  const [splashUploading, setSplashUploading] = useState(false);

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setExtracting(true);
    setBrandingMessage(null);
    try {
      const mime = (file.type || "").toLowerCase();
      const ext =
        mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "png").toLowerCase();
      const path = `${restaurant.id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("restaurant-assets")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type || undefined });
      if (uploadErr) {
        setBrandingMessage(`Logo-Upload fehlgeschlagen: ${uploadErr.message}`);
        return;
      }
      const { data } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
      const url = data.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
      const { error: updateErr } = await supabase
        .from("restaurants")
        .update({ logo_url: url })
        .eq("id", restaurant.id);
      if (updateErr) {
        setBrandingMessage(`Speichern fehlgeschlagen: ${updateErr.message}`);
        return;
      }
      if (url) {
        setCurrentLogoUrl(url);
        setLogoPreview(url);
      }
      onRestaurantChange({ ...restaurant, logo_url: url ?? restaurant.logo_url });
      onToast("✓ Logo gespeichert");
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }

  async function handleSplashMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    const isVideo = (original.type || "").toLowerCase().startsWith("video/");
    const isImage = (original.type || "").toLowerCase().startsWith("image/");
    if (!isVideo && !isImage) {
      onToast("Nur JPG/PNG oder MP4 erlaubt.");
      e.target.value = "";
      return;
    }
    if (isVideo && original.size > 30 * 1024 * 1024) {
      onToast("Video zu groß — bitte unter 30MB");
      e.target.value = "";
      return;
    }
    let file: File = original;
    if (isImage) {
      try {
        file = await compressImageFile(original, { maxWidth: 1920, quality: 0.8 });
      } catch {
        file = original;
      }
      if (file.size > 5 * 1024 * 1024) {
        onToast("Bild zu groß — bitte unter 5MB");
        e.target.value = "";
        return;
      }
    }
    setSplashUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg")).toLowerCase();
      const filename = `${isVideo ? "video" : "image"}-${Date.now()}.${ext}`;
      const path = `splash/${restaurant.id}/${filename}`;
      const { error: uploadErr } = await supabase.storage
        .from("restaurant-assets")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type || undefined });
      if (uploadErr) {
        onToast(`Upload fehlgeschlagen: ${uploadErr.message}`);
        return;
      }
      const { data } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
      const url = data.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
      const mediaType: "image" | "video" = isVideo ? "video" : "image";
      const { data: updateData, error: updateErr } = await supabase
        .from("restaurants")
        .update({ splash_media_url: url, splash_media_type: mediaType })
        .eq("id", restaurant.id)
        .select("id");
      if (updateErr) {
        onToast(`Speichern fehlgeschlagen: ${updateErr.message}`);
        return;
      }
      if (!updateData || updateData.length === 0) {
        onToast("Speichern fehlgeschlagen — keine Berechtigung");
        return;
      }
      onRestaurantChange({ ...restaurant, splash_media_url: url, splash_media_type: mediaType });
      onToast("✓ Splash-Hintergrund gespeichert");
    } finally {
      setSplashUploading(false);
      e.target.value = "";
    }
  }

  async function handleSplashMediaRemove() {
    if (!restaurant.splash_media_url) return;
    setSplashUploading(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .update({ splash_media_url: null, splash_media_type: null })
        .eq("id", restaurant.id)
        .select("id");
      if (error) {
        onToast(`Entfernen fehlgeschlagen: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        onToast("Entfernen fehlgeschlagen — keine Berechtigung");
        return;
      }
      onRestaurantChange({ ...restaurant, splash_media_url: null, splash_media_type: null });
      onToast("✓ Splash-Hintergrund entfernt");
    } finally {
      setSplashUploading(false);
    }
  }

  async function handlePatchRestaurant(patch: Patch) {
    const { data, error } = await supabase
      .from("restaurants")
      .update(patch)
      .eq("id", restaurant.id)
      .select("id");
    if (error) {
      onToast(error.message ?? "Speichern fehlgeschlagen");
      return;
    }
    if (!data || data.length === 0) {
      onToast("Speichern fehlgeschlagen — keine Berechtigung");
      return;
    }
    onRestaurantChange({ ...restaurant, ...patch } as DashboardRestaurant);
    onToast("✓ Gespeichert");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login?redirect=/dashboard");
  }

  return {
    logoPreview,
    currentLogoUrl,
    extracting,
    brandingMessage,
    splashUploading,
    handleLogoChange,
    handleSplashMediaChange,
    handleSplashMediaRemove,
    handlePatchRestaurant,
    handleLogout,
  };
}

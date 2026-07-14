import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth-store";
import { Camera, Check, Loader2, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SetupProfile() {
  const { session, fetchProfile } = useAuthStore();
  const user = session?.user;
  
  // Default to OAuth provided values if available
  const defaultUsername = user?.user_metadata?.full_name?.replace(/[^a-zA-Z0-9_.]/g, "").substring(0, 20) || "";
  const defaultAvatar = user?.user_metadata?.avatar_url || "";

  const [username, setUsername] = useState(defaultUsername);
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live username validation
  useEffect(() => {
    const checkUsername = async () => {
      setUsernameError("");
      
      if (!username) {
        setUsernameError("Username is required");
        return;
      }
      if (username.length < 3 || username.length > 20) {
        setUsernameError("Must be between 3 and 20 characters");
        return;
      }
      if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
        setUsernameError("Only letters, numbers, underscores, and periods allowed");
        return;
      }

      setIsCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (error) throw error;
        
        if (data && data.id !== user?.id) {
          setUsernameError("Username is already taken");
        }
      } catch (err) {
        console.error("Username check error", err);
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username, user?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, or WEBP image.");
      return;
    }
    
    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }

    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user) return;
    if (usernameError || isCheckingUsername || !username) {
      toast.error("Please provide a valid username");
      return;
    }

    setIsSaving(true);
    
    try {
      let finalAvatarUrl = avatarUrl;

      // 1. Upload avatar if a new one was selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        finalAvatarUrl = publicUrlData.publicUrl;
      }

      // 2. Insert or update the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          avatar_url: finalAvatarUrl,
          setup_complete: true,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      toast.success("Profile setup complete!");
      
      // Force refresh the auth store to pull the new profile
      await fetchProfile(user.id);
      
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save profile: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = previewUrl || avatarUrl;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#09090B] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl">
        {/* Header using Banner */}
        <div className="h-32 w-full overflow-hidden relative bg-[#09090B] border-b border-white/5">
          <img src="/images/vertex_banner.png" alt="Vertex" className="w-full h-full object-cover opacity-80" />
        </div>
        
        <div className="px-8 pb-8 pt-0 relative flex flex-col items-center">
          
          {/* Avatar Section */}
          <div className="relative -mt-16 mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-[#111111] bg-[#18181B] shadow-xl transition-transform group-hover:scale-105">
              {displayAvatar ? (
                <img src={displayAvatar} alt="Avatar Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#B3B3B3]">
                  <UserIcon size={48} />
                </div>
              )}
            </div>
            
            {/* Overlay for hover */}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
              <Camera className="text-white" size={32} />
            </div>

            <button 
              className="absolute bottom-0 right-0 rounded-full bg-[#222] p-2 text-white shadow-lg border-2 border-[#111111] hover:bg-[#333] transition-colors"
            >
              <Upload size={16} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg, image/png, image/webp" 
              onChange={handleFileSelect} 
            />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to Vertex</h1>
            <p className="text-[#B3B3B3] mt-1 text-sm">Let's finish setting up your profile.</p>
          </div>

          {/* Username Section */}
          <div className="w-full mb-8">
            <label className="text-sm font-medium text-[#B3B3B3] mb-2 block">Choose a Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cn(
                  "w-full rounded-xl border border-white/10 bg-[#09090B] px-4 py-3 text-white placeholder-white/30 outline-none transition-all focus:border-white/30 focus:bg-[#18181B]",
                  usernameError ? "border-red-500 focus:border-red-500" : ""
                )}
                placeholder="e.g. shadow_hunter"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isCheckingUsername ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                ) : username && !usernameError ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : null}
              </div>
            </div>
            {usernameError && (
               <p className="mt-2 text-sm text-red-400">{usernameError}</p>
            )}
            {!usernameError && username && (
              <p className="mt-2 text-sm text-green-400">Username is available!</p>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!!usernameError || isCheckingUsername || isSaving || !username}
            className="w-full rounded-xl bg-white px-4 py-3 font-bold text-black shadow-lg transition-all hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue to Dashboard"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

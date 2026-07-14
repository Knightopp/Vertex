import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { libraryManager } from "@/services/LibraryManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLibraryStore } from "@/stores/library-store";

export function AddEntryModal() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [exePath, setExePath] = useState("");
  const [type, setType] = useState<"game" | "application">("game");
  const refreshLibrary = useLibraryStore((s) => s.fetchLibrary);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !exePath) {
      toast.error("Please provide both title and executable path.");
      return;
    }

    try {
      const exeName = exePath.split("\\").pop()?.split("/").pop() || exePath;
      
      await libraryManager.createEntry({
        title,
        executablePath: exePath,
        executableName: exeName,
        type,
        status: "backlog"
      });
      
      toast.success(`${title} added to library!`);
      refreshLibrary();
      setOpen(false);
      setTitle("");
      setExePath("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add entry.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex h-12 w-full items-center justify-center text-white/40 hover:text-white transition-all duration-200" title="Add Game/App Manually">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <Plus className="w-5 h-5 text-current" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[#1A1125] text-white border-white/10">
        <DialogHeader>
          <DialogTitle>Add Custom Game/App</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3 bg-black/20 border-white/10"
              placeholder="e.g. My Cracked Game"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="exePath" className="text-right">
              Exe Path
            </Label>
            <Input
              id="exePath"
              value={exePath}
              onChange={(e) => setExePath(e.target.value)}
              className="col-span-3 bg-black/20 border-white/10"
              placeholder="C:\Games\Game\game.exe"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <Select value={type} onValueChange={(val: "game"|"application") => setType(val)}>
              <SelectTrigger className="col-span-3 bg-black/20 border-white/10">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1125] text-white border-white/10">
                <SelectItem value="game">Game</SelectItem>
                <SelectItem value="application">Application</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end mt-4">
            <Button type="submit" className="bg-white text-black hover:bg-white/90">
              Add Item
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

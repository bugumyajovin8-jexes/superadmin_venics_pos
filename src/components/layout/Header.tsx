import { Bell, Search, User } from "lucide-react"
import { Input } from "@/src/components/ui/Input"
import { Button } from "@/src/components/ui/Button"

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      
      <div className="flex items-center gap-4">
        <div className="relative hidden w-64 md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            type="search" 
            placeholder="Search merchants, users..." 
            className="pl-9 bg-slate-50 border-slate-200"
          />
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-slate-500">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </Button>
        
        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden flex-col md:flex">
            <span className="text-sm font-medium text-slate-900">Admin User</span>
            <span className="text-xs text-slate-500">Superadmin</span>
          </div>
        </div>
      </div>
    </header>
  )
}

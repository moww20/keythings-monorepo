'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { 
  User, 
  Edit3, 
  QrCode, 
  Zap, 
  Share2, 
  MoreHorizontal,
  Heart,
  MessageCircle,
  Repeat2,
  ExternalLink
} from 'lucide-react';

export default function ProfilePage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('posts');

  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'replies', label: 'Replies' },
    { id: 'reposts', label: 'Reposts' },
    { id: 'media', label: 'Media' },
    { id: 'likes', label: 'Likes' },
    { id: 'articles', label: 'Articles' },
  ];

  const posts = [
    {
      id: 1,
      content: "> my first time twatting! sup",
      timestamp: "36d",
      likes: 0,
      reposts: 0,
      replies: 0
    },
    {
      id: 2,
      content: "test",
      timestamp: "49d",
      likes: 0,
      reposts: 0,
      replies: 0
    },
    {
      id: 3,
      content: "test",
      timestamp: "49d",
      likes: 0,
      reposts: 0,
      replies: 0
    }
  ];

  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-full">
            <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  {/* Banner with Profile Avatar */}
                   <div className="h-48 bg-gray-800 relative rounded-lg">
                     {/* Profile Picture positioned on banner */}
                     <div className="absolute bottom-0 left-4 transform translate-y-1/2">
                       <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center border-4 border-[color:var(--background)]">
                         <User className="w-10 h-10 text-white" />
                       </div>
                     </div>
                   </div>

                  {/* Profile Section */}
                  <div className="pt-12">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      
                      {/* Profile Info */}
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-foreground">Profile Name</h1>
                        <p className="text-muted text-sm mt-2">Your profile description goes here</p>
                        
                        {/* Following/Followers */}
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-sm text-muted">
                            <span className="font-medium text-foreground">-</span> Following
                          </span>
                          <span className="text-sm text-muted">
                            <span className="font-medium text-foreground">-</span> Followers
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <Zap className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit profile
                      </Button>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="mt-6 border-b border-hairline">
                    <nav className="flex space-x-8">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                              ? 'border-accent text-foreground'
                              : 'border-transparent text-muted hover:text-foreground hover:border-hairline'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Content Feed */}
                  <div className="mt-6 space-y-4">
                    {posts.map((post) => (
                      <Card key={post.id} className="glass border border-hairline bg-surface">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Post Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            
                            {/* Post Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">Hey Mow!</span>
                                <span className="text-muted text-sm">{post.timestamp}</span>
                              </div>
                              
                              <p className="text-foreground mb-3">{post.content}</p>
                              
                              {/* Post Actions */}
                              <div className="flex items-center gap-6">
                                <button className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
                                  <MessageCircle className="w-4 h-4" />
                                  <span className="text-sm">{post.replies}</span>
                                </button>
                                <button className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
                                  <Repeat2 className="w-4 h-4" />
                                  <span className="text-sm">{post.reposts}</span>
                                </button>
                                <button className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
                                  <Heart className="w-4 h-4" />
                                  <span className="text-sm">{post.likes}</span>
                                </button>
                                <button 
                                  className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
                                  aria-label="Share post"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* More Options */}
                            <button 
                              className="text-muted hover:text-foreground transition-colors"
                              aria-label="More options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
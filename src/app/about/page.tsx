"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HelpCircle, Github, ExternalLink, Mail, Shield, Users, Target } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">About Keythings</h1>
        <p className="text-lg text-muted">
          The next-generation wallet and explorer for the Keeta Network
        </p>
      </div>

      <div className="grid gap-8">
        {/* Mission */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-accent" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              Keythings is built to provide a secure, intuitive, and powerful interface for interacting with the Keeta Network. 
              We believe in decentralization, user sovereignty, and making blockchain technology accessible to everyone.
            </p>
            <p className="text-foreground">
              Our wallet puts you in complete control of your assets with zero custody architecture, while our explorer 
              provides transparent insights into network activity.
            </p>
          </CardContent>
        </Card>

        {/* Key Features */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
            <CardDescription>
              What makes Keythings different
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Zero-Custody Security</h4>
                    <p className="text-sm text-muted">
                      Your keys, your crypto. We never have access to your funds or private keys.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">User-Controlled</h4>
                    <p className="text-sm text-muted">
                      Every transaction requires your explicit approval through the wallet extension.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Network Explorer</h4>
                    <p className="text-sm text-muted">
                      Real-time insights into accounts, tokens, storage, and transactions on Keeta.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Github className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">Open Source</h4>
                    <p className="text-sm text-muted">
                      Fully transparent and auditable codebase built by the community.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technology Stack */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Technology</CardTitle>
            <CardDescription>
              Built with modern tools and best practices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary">Next.js</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
              <Badge variant="secondary">shadcn/ui</Badge>
              <Badge variant="secondary">Keeta SDK</Badge>
              <Badge variant="secondary">React</Badge>
            </div>
            <p className="text-sm text-muted">
              Our application leverages the latest web technologies to deliver a fast, secure, and responsive user experience 
              across all devices. The wallet extension integrates seamlessly with your browser while maintaining strict security boundaries.
            </p>
          </CardContent>
        </Card>

        {/* Get Involved */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Get Involved</CardTitle>
            <CardDescription>
              Join the Keythings community
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              Keythings is an open-source project. We welcome contributions, feedback, and community engagement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link 
                  href="https://github.com/moww20/keythings-extension-wallet" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Wallet Extension
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link 
                  href="https://github.com/moww20/keythings-monorepo" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Web Application
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link 
                  href="https://discord.gg/keythings" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Discord Community
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link 
                  href="https://x.com/keythings" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Follow on X
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Version Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Web Application:</span>
              <span className="text-foreground">Latest</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Wallet Extension:</span>
              <span className="text-foreground">Latest</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Keeta Network:</span>
              <span className="text-foreground">Testnet</span>
            </div>
            <Separator />
            <p className="text-xs text-muted text-center">
              © 2024 Keythings. Built for the Keeta Network ecosystem.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const metadata = {
  title: "Posting Tutorial — Keythings Wallet Docs",
  description: "Master content creation on Keythings Wallet with posts, media uploads, and engagement strategies.",
  alternates: { canonical: "/docs/tutorials/posting" },
}

export default function PostingTutorialPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Posting Tutorial</h1>
      <div className="docs-prose">
        <p><em>Master the art of content creation on Twatter.Army. Learn to craft engaging posts, upload media, and build your audience.</em></p>

        <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-300">
                <strong>Time to complete:</strong> 15-20 minutes<br/>
                <strong>Prerequisites:</strong> Completed setup tutorial
              </p>
            </div>
          </div>
        </div>

        <h2>The Composer Interface</h2>
        <p>Twatter.Army's composer is your gateway to content creation:</p>

        <h3>Accessing the Composer</h3>
        <ul>
          <li><strong>Main composer:</strong> Click the text area at the top of your feed</li>
          <li><strong>Quick compose:</strong> Press <code>N</code> from anywhere on the page</li>
          <li><strong>Mobile compose:</strong> Tap the floating compose button on mobile</li>
          <li><strong>Reply composer:</strong> Click "Reply" on any post</li>
        </ul>

        <h3>Composer Features</h3>
        <div className="border rounded-lg p-4 my-4">
          <h4 className="font-semibold mb-2">Text Area</h4>
          <ul className="text-sm">
            <li>Character counter (65,535 character limit)</li>
            <li>Auto-expanding height</li>
            <li>Real-time preview</li>
            <li>Keyboard shortcuts support</li>
          </ul>
        </div>

        <div className="border rounded-lg p-4 my-4">
          <h4 className="font-semibold mb-2">Toolbar</h4>
          <ul className="text-sm">
            <li><strong>Media button:</strong> Upload images, videos, documents</li>
            <li><strong>Emoji picker:</strong> Add emojis and special characters</li>
            <li><strong>Preview toggle:</strong> See how your post will look</li>
            <li><strong>Draft save:</strong> Auto-saves your work</li>
          </ul>
        </div>

        <h2>Creating Text Posts</h2>
        <p>The foundation of content on Nostr:</p>

        <h3>Basic Text Post</h3>
        <ol>
          <li>Open the composer</li>
          <li>Type your message (1-65,535 characters)</li>
          <li>Review your post in the preview</li>
          <li>Click <strong>"Post"</strong> to publish</li>
        </ol>

        <h3>Enhanced Text Techniques</h3>

        <h4>Using Hashtags</h4>
        <ul>
          <li><strong>Discovery:</strong> Hashtags help others find your content</li>
          <li><strong>Trending:</strong> Popular hashtags increase visibility</li>
          <li><strong>Organization:</strong> Group related posts together</li>
          <li><strong>Examples:</strong> #nostr #web3 #cryptocurrency #tech</li>
        </ul>

        <h4>Mentioning Users</h4>
        <ul>
          <li><strong>@username:</strong> Tag users in your posts</li>
          <li><strong>Notifications:</strong> Mentioned users get notified</li>
          <li><strong>Autocomplete:</strong> Type @ and see suggestions</li>
          <li><strong>Public keys:</strong> Use npub... format for direct addressing</li>
        </ul>

        <h4>Formatting Tips</h4>
        <ul>
          <li><strong>Line breaks:</strong> Use Shift+Enter for new lines</li>
          <li><strong>Emojis:</strong> Add personality with emoji picker</li>
          <li><strong>Links:</strong> URLs are automatically clickable</li>
          <li><strong>Code blocks:</strong> Use backticks for `code snippets`</li>
        </ul>

        <h2>Media-Rich Posts</h2>
        <p>Elevate your content with visuals:</p>

        <h3>Uploading Images</h3>
        <ol>
          <li>Click the <strong>image icon</strong> in the composer</li>
          <li>Select files from your device or drag & drop</li>
          <li>Supported formats: JPG, PNG, GIF, WebP</li>
          <li>Maximum file size: 10MB per image</li>
          <li>Add multiple images for galleries</li>
        </ol>

        <h3>Uploading Videos</h3>
        <ol>
          <li>Select video files (MP4, WebM, MOV)</li>
          <li>Maximum file size: 100MB</li>
          <li>Videos are optimized for web playback</li>
          <li>Thumbnails are automatically generated</li>
        </ol>

        <h3>Document Sharing</h3>
        <ul>
          <li><strong>Supported formats:</strong> PDF, DOC, TXT, and more</li>
          <li><strong>Secure uploads:</strong> All files are encrypted in transit</li>
          <li><strong>Global CDN:</strong> Fast downloads worldwide</li>
          <li><strong>Preview support:</strong> Many file types show previews</li>
        </ul>

        <h3>Media Best Practices</h3>
        <ul>
          <li><strong>Alt text:</strong> Describe images for accessibility</li>
          <li><strong>Optimization:</strong> Compress large files before uploading</li>
          <li><strong>Relevance:</strong> Choose media that enhances your message</li>
          <li><strong>Originality:</strong> Use your own content or properly attribute</li>
        </ul>

        <h2>Advanced Posting Techniques</h2>
        <p>Take your content creation to the next level:</p>

        <h3>Threaded Posts</h3>
        <p>Tell longer stories across multiple posts:</p>
        <ol>
          <li>Create your first post</li>
          <li>Reply to your own post to continue the thread</li>
          <li>Use numbers or emojis to indicate sequence (1/5, 2/5, etc.)</li>
          <li>End with a call-to-action or summary</li>
        </ol>

        <h3>Quoted Reposts</h3>
        <p>Add your commentary to others' content:</p>
        <ol>
          <li>Find a post you want to share</li>
          <li>Click the <strong>quote repost</strong> button</li>
          <li>Add your thoughts or analysis</li>
          <li>The original post appears embedded in your post</li>
        </ol>

        <h3>Event Announcements</h3>
        <p>Promote events and gatherings:</p>
        <ul>
          <li>Use dedicated hashtags like #meetup or #conference</li>
          <li>Include date, time, and location details</li>
          <li>Use event-specific emojis 📅🎉</li>
          <li>Follow up with event updates and photos</li>
        </ul>

        <h3>Polls and Questions</h3>
        <p>Engage your audience with interactive content:</p>
        <ul>
          <li>Ask questions to spark discussion</li>
          <li>Create simple polls with emoji reactions</li>
          <li>Use Q&A threads for deeper engagement</li>
          <li>Respond to answers to build community</li>
        </ul>

        <h2>Content Strategy</h2>
        <p>Develop a consistent and engaging posting strategy:</p>

        <h3>Content Types</h3>
        <div className="grid md:grid-cols-2 gap-4 my-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Original Content</h4>
            <ul className="text-sm">
              <li>Personal thoughts and opinions</li>
              <li>Original research and analysis</li>
              <li>Creative writing and poetry</li>
              <li>Personal photos and art</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Curated Content</h4>
            <ul className="text-sm">
              <li>News and current events</li>
              <li>Educational content</li>
              <li>Industry insights</li>
              <li>Community highlights</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Interactive Content</h4>
            <ul className="text-sm">
              <li>Questions and discussions</li>
              <li>Polls and surveys</li>
              <li>Live commentary</li>
              <li>Collaborative threads</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Multimedia Content</h4>
            <ul className="text-sm">
              <li>Photo essays and galleries</li>
              <li>Video tutorials and demos</li>
              <li>Audio clips and music</li>
              <li>Infographics and charts</li>
            </ul>
          </div>
        </div>

        <h3>Posting Frequency</h3>
        <ul>
          <li><strong>Consistency:</strong> Post regularly but don't spam</li>
          <li><strong>Quality over quantity:</strong> Focus on valuable content</li>
          <li><strong>Engagement timing:</strong> Post when your audience is active</li>
          <li><strong>Batch creation:</strong> Create multiple posts at once for consistency</li>
        </ul>

        <h3>Hashtag Strategy</h3>
        <ul>
          <li><strong>Primary hashtags:</strong> 2-3 main topic hashtags per post</li>
          <li><strong>Trending hashtags:</strong> Include popular tags when relevant</li>
          <li><strong>Branded hashtags:</strong> Create unique tags for your content</li>
          <li><strong>Location tags:</strong> Use city or region hashtags</li>
        </ul>

        <h2>Engagement Optimization</h2>
        <p>Maximize your content's reach and impact:</p>

        <h3>Timing Your Posts</h3>
        <ul>
          <li><strong>Peak hours:</strong> Post when your audience is most active</li>
          <li><strong>Time zones:</strong> Consider global audience locations</li>
          <li><strong>Event timing:</strong> Align with current events or trends</li>
          <li><strong>Testing:</strong> Experiment with different posting times</li>
        </ul>

        <h3>Call-to-Actions</h3>
        <p>Encourage audience interaction:</p>
        <ul>
          <li>"What do you think?"</li>
          <li>"Share your experience!"</li>
          <li>"Tag a friend who..."</li>
          <li>"Reply with your thoughts"</li>
        </ul>

        <h3>Cross-Platform Promotion</h3>
        <ul>
          <li>Share your best Twatter.Army posts on other platforms</li>
          <li>Include your Nostr profile link in other bios</li>
          <li>Drive traffic from your website or blog</li>
          <li>Collaborate with other creators</li>
        </ul>

        <h2>Best Practices</h2>
        <p>Content creation guidelines for success:</p>

        <h3>Content Quality</h3>
        <ul>
          <li><strong>Originality:</strong> Share your unique perspective</li>
          <li><strong>Value:</strong> Provide useful information or entertainment</li>
          <li><strong>Accuracy:</strong> Fact-check information before posting</li>
          <li><strong>Relevance:</strong> Stay on topic with your niche</li>
        </ul>

        <h3>Community Guidelines</h3>
        <ul>
          <li><strong>Respect:</strong> Treat others with kindness</li>
          <li><strong>Inclusion:</strong> Make content accessible to all</li>
          <li><strong>Privacy:</strong> Don't share others' personal information</li>
          <li><strong>Legality:</strong> Follow applicable laws and regulations</li>
        </ul>

        <h3>Technical Excellence</h3>
        <ul>
          <li><strong>Proofreading:</strong> Check spelling and grammar</li>
          <li><strong>Formatting:</strong> Use clear, readable text</li>
          <li><strong>SEO:</strong> Use relevant keywords and hashtags</li>
          <li><strong>Accessibility:</strong> Consider users with disabilities</li>
        </ul>

        <h2>Analytics and Growth</h2>
        <p>Track your content performance:</p>

        <h3>Measuring Success</h3>
        <ul>
          <li><strong>Engagement metrics:</strong> Likes, reposts, replies</li>
          <li><strong>Reach:</strong> How many people see your content</li>
          <li><strong>Growth:</strong> New followers and connections</li>
          <li><strong>Interactions:</strong> Quality of conversations started</li>
        </ul>

        <h3>Growth Strategies</h3>
        <ul>
          <li><strong>Consistent posting:</strong> Regular, quality content</li>
          <li><strong>Community engagement:</strong> Reply to comments and mentions</li>
          <li><strong>Collaboration:</strong> Work with other creators</li>
          <li><strong>Value creation:</strong> Help others in your niche</li>
        </ul>

        <h2>Troubleshooting</h2>
        <p>Common posting issues and solutions:</p>

        <h3>Upload Problems</h3>
        <ul>
          <li><strong>File size:</strong> Compress large files or use smaller resolutions</li>
          <li><strong>Format issues:</strong> Convert to supported formats</li>
          <li><strong>Network:</strong> Check your internet connection</li>
          <li><strong>Browser:</strong> Try a different browser or clear cache</li>
        </ul>

        <h3>Content Not Appearing</h3>
        <ul>
          <li><strong>Propagation delay:</strong> Posts may take time to appear across relays</li>
          <li><strong>Relay issues:</strong> Try different relays if content doesn't show</li>
          <li><strong>Browser cache:</strong> Refresh the page or clear cache</li>
          <li><strong>Network filters:</strong> Some networks may block content</li>
        </ul>

        <h3>Engagement Issues</h3>
        <ul>
          <li><strong>Timing:</strong> Post when your audience is active</li>
          <li><strong>Content quality:</strong> Focus on valuable, engaging posts</li>
          <li><strong>Interaction:</strong> Engage with others' content regularly</li>
          <li><strong>Hashtags:</strong> Use relevant, popular hashtags</li>
        </ul>

        <h2>Advanced Features</h2>
        <p>Unlock the full potential of Twatter.Army:</p>

        <h3>Scheduled Posts</h3>
        <p>Plan your content calendar:</p>
        <ul>
          <li>Use external tools to draft posts</li>
          <li>Schedule posts for optimal timing</li>
          <li>Batch create content for consistency</li>
          <li>Use automation tools responsibly</li>
        </ul>

        <h3>Content Series</h3>
        <p>Create themed content collections:</p>
        <ul>
          <li>Weekly recap threads</li>
          <li>Educational series</li>
          <li>Project updates</li>
          <li>Community spotlights</li>
        </ul>

        <h3>Collaborative Content</h3>
        <p>Work with other creators:</p>
        <ul>
          <li>Co-host discussions</li>
          <li>Cross-promote content</li>
          <li>Interview other users</li>
          <li>Run joint giveaways or contests</li>
        </ul>

        <div className="bg-green-500/10 border-l-4 border-green-500 p-4 my-6 rounded-r-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-300">
                <strong>Pro tip:</strong> The best content comes from authentic expression.
                Share your genuine thoughts, experiences, and expertise. Quality always beats quantity.
              </p>
            </div>
          </div>
        </div>

        <h2>Resources</h2>
        <div className="grid md:grid-cols-2 gap-4 my-6">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Continue Learning</h4>
            <ul className="text-sm space-y-1">
              <li><a href="/docs/search" className="text-accent-gradient hover:underline">Advanced Search</a></li>
              <li><a href="/docs/profiles" className="text-accent-gradient hover:underline">Profile Optimization</a></li>
              <li><a href="/docs/media" className="text-accent-gradient hover:underline">Media Best Practices</a></li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold">Community Resources</h4>
            <ul className="text-sm space-y-1">
              <li><a href="https://discord.gg/twatter" className="text-accent-gradient hover:underline">Creator Community</a></li>
              <li><a href="/docs/tutorials/community" className="text-accent-gradient hover:underline">Building Community</a></li>
              <li><a href="/docs/tutorials/search" className="text-accent-gradient hover:underline">Finding Inspiration</a></li>
            </ul>
          </div>
        </div>

        <blockquote>
          Content creation on Twatter.Army is about building genuine connections in a decentralized world.
          Focus on authenticity, value, and community— the rest will follow naturally.
        </blockquote>
      </div>
    </div>
  )
}

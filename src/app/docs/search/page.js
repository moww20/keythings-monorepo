export const metadata = {
  title: "Search & Discovery — Keythings Website Docs",
  description: "Master advanced search with NIP-50 full-text support, smart ranking, and powerful query language.",
  alternates: { canonical: "/docs/search" },
}

export default function SearchPage() {
  return (
    <div className="rounded-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">Search & Discovery</h1>
      <div className="docs-prose">
        <p><em>Powerful search capabilities with real-time results, advanced filtering, and intelligent ranking algorithms.</em></p>

        <h2>Search Overview</h2>
        <p>
          Keythings's search system combines multiple technologies to deliver fast, relevant results:
        </p>
        <ul>
          <li><strong>NIP-50 full-text search</strong>: When supported by relays</li>
          <li><strong>Real-time streaming</strong>: Live results as you type</li>
          <li><strong>Smart ranking</strong>: Results ranked by recency, engagement, and trust</li>
          <li><strong>Advanced query language</strong>: Powerful filtering and search operators</li>
        </ul>

        <h2>Basic Search</h2>
        <p>Getting started with search is simple:</p>

        <h3>Quick Search</h3>
        <ol>
          <li>Click the search bar at the top of any page</li>
          <li>Type keywords, usernames, or hashtags</li>
          <li>Results appear instantly as you type</li>
          <li>Press Enter or click the search icon to see all results</li>
        </ol>

        <h3>Search Results</h3>
        <p>Search results are organized into tabs:</p>
        <ul>
          <li><strong>Posts</strong>: Text posts, replies, and articles</li>
          <li><strong>People</strong>: User profiles and accounts</li>
          <li><strong>Hashtags</strong>: Trending topics and conversations</li>
        </ul>

        <h2>Advanced Search Operators</h2>
        <p>Use special syntax for precise searches:</p>

        <h3>Hashtag Search</h3>
        <p>Find posts about specific topics:</p>
        <ul>
          <li><code>#nostr</code> - Posts tagged with #nostr</li>
          <li><code>#bitcoin #lightning</code> - Posts with both hashtags</li>
          <li><code>#crypto OR #defi</code> - Posts with either hashtag</li>
        </ul>

        <h3>User Search</h3>
        <p>Find users and mentions:</p>
        <ul>
          <li><code>@username</code> - Posts mentioning a user</li>
          <li><code>@npub1...</code> - Posts by specific public key</li>
          <li><code>from:@username</code> - Posts authored by a user</li>
        </ul>

        <h3>Content Type Filtering</h3>
        <p>Filter by Nostr event kinds:</p>
        <ul>
          <li><code>kind:1</code> - Regular text posts</li>
          <li><code>kind:6</code> - Reposts and shares</li>
          <li><code>kind:30023</code> - Long-form articles</li>
          <li><code>is:reply</code> - Reply posts only</li>
        </ul>

        <h3>Media Search</h3>
        <p>Find posts with media content:</p>
        <ul>
          <li><code>has:media</code> - Posts with images, videos, or files</li>
          <li><code>has:image</code> - Posts with images only</li>
          <li><code>has:video</code> - Posts with videos only</li>
        </ul>

        <h3>Time-Based Search</h3>
        <p>Search within specific time ranges:</p>
        <ul>
          <li><code>since:1d</code> - Posts from the last day</li>
          <li><code>since:1w</code> - Posts from the last week</li>
          <li><code>since:2024-01-01</code> - Posts since specific date</li>
          <li><code>until:2024-12-31</code> - Posts before specific date</li>
        </ul>

        <h3>Complex Queries</h3>
        <p>Combine multiple operators:</p>
        <ul>
          <li><code>#bitcoin has:media since:1w</code> - Bitcoin posts with media from the last week</li>
          <li><code>@satoshi is:reply</code> - Replies to Satoshi's posts</li>
          <li><code>kind:30023 #tutorial</code> - Tutorial articles</li>
        </ul>

        <h2>Search Suggestions</h2>
        <p>As you type, Keythings suggests:</p>

        <h3>Autocomplete Features</h3>
        <ul>
          <li><strong>Hashtag completion</strong>: Popular hashtags matching your input</li>
          <li><strong>User suggestions</strong>: Users you've interacted with recently</li>
          <li><strong>Trending topics</strong>: Currently popular search terms</li>
          <li><strong>Search history</strong>: Your previous searches</li>
        </ul>

        <h3>Smart Suggestions</h3>
        <p>The suggestion system learns from:</p>
        <ul>
          <li>Your search history and preferences</li>
          <li>Popular searches across the platform</li>
          <li>Trending topics and hashtags</li>
          <li>Users you follow and interact with</li>
        </ul>

        <h2>Ranking Algorithm</h2>
        <p>Results are ranked by multiple factors:</p>

        <h3>Primary Ranking Factors</h3>
        <ul>
          <li><strong>Recency</strong> (60%): Newer posts rank higher</li>
          <li><strong>Engagement</strong> (30%): Likes, reposts, and replies boost ranking</li>
          <li><strong>Trust</strong> (10%): NIP-05 verified accounts and network effects</li>
        </ul>

        <h3>Content Quality Signals</h3>
        <ul>
          <li>Posts from verified accounts (NIP-05)</li>
          <li>Content with media attachments</li>
          <li>Posts that spark conversations</li>
          <li>Author reputation and follower count</li>
        </ul>

        <h3>Personalization</h3>
        <p>Search results are personalized based on:</p>
        <ul>
          <li>Users you follow and interact with</li>
          <li>Topics you've engaged with recently</li>
          <li>Your geographic location (optional)</li>
          <li>Language preferences</li>
        </ul>

        <h2>Real-Time Search</h2>
        <p>Experience live search results:</p>

        <h3>Streaming Results</h3>
        <ul>
          <li><strong>Live updates</strong>: New posts appear instantly</li>
          <li><strong>Real-time ranking</strong>: Rankings update as posts gain engagement</li>
          <li><strong>Connection status</strong>: Visual indicators for live vs cached results</li>
        </ul>

        <h3>Performance Optimizations</h3>
        <ul>
          <li><strong>Debounced queries</strong>: Smart delay to prevent excessive API calls</li>
          <li><strong>Result caching</strong>: Fast retrieval of recent searches</li>
          <li><strong>Progressive loading</strong>: Load more results as you scroll</li>
        </ul>

        <h2>Advanced Features</h2>
        <p>Power user capabilities:</p>

        <h3>Search Filters</h3>
        <p>Refine your search with filters:</p>
        <ul>
          <li><strong>Language filter</strong>: Search in specific languages</li>
          <li><strong>Media type filter</strong>: Images, videos, or text-only</li>
          <li><strong>Account type filter</strong>: Verified accounts only</li>
          <li><strong>Engagement filter</strong>: Minimum likes/reposts</li>
        </ul>

        <h3>Saved Searches</h3>
        <ul>
          <li>Save frequently used search queries</li>
          <li>Get notifications for new results</li>
          <li>Create custom feeds from search results</li>
          <li>Share saved searches with others</li>
        </ul>

        <h3>Search Analytics</h3>
        <ul>
          <li>View trending topics and hashtags</li>
          <li>See search volume over time</li>
          <li>Discover related searches and topics</li>
          <li>Track engagement on your search results</li>
        </ul>

        <h2>Search Tips & Tricks</h2>
        <p>Make the most of Keythings's search:</p>

        <h3>Effective Searching</h3>
        <ul>
          <li><strong>Use specific keywords</strong>: "bitcoin price prediction" vs just "bitcoin"</li>
          <li><strong>Combine operators</strong>: Mix hashtags, users, and time filters</li>
          <li><strong>Try variations</strong>: Use synonyms and related terms</li>
          <li><strong>Check spelling</strong>: Typos can significantly reduce results</li>
        </ul>

        <h3>Discovery Strategies</h3>
        <ul>
          <li><strong>Follow trending hashtags</strong>: Discover what's popular right now</li>
          <li><strong>Explore user networks</strong>: Find interesting people through their connections</li>
          <li><strong>Use advanced operators</strong>: Filter for high-quality, niche content</li>
          <li><strong>Set up alerts</strong>: Get notified about topics you care about</li>
        </ul>

        <h3>Privacy Considerations</h3>
        <ul>
          <li>Search queries are processed locally when possible</li>
          <li>No search history is stored without your consent</li>
          <li>You can clear search history anytime</li>
          <li>Private browsing mode available</li>
        </ul>

        <h2>Keyboard Shortcuts</h2>
        <p>Power users can use keyboard shortcuts:</p>
        <ul>
          <li><code>/</code> - Focus search bar from anywhere</li>
          <li><code>↑/↓</code> - Navigate search suggestions</li>
          <li><code>Enter</code> - Execute search</li>
          <li><code>Esc</code> - Clear search/close suggestions</li>
        </ul>

        <h2>Troubleshooting</h2>
        <p>Common search issues and solutions:</p>

        <h3>No Results Found</h3>
        <ul>
          <li>Try broader search terms or fewer filters</li>
          <li>Check spelling and remove special characters</li>
          <li>Try searching for related terms or synonyms</li>
          <li>Some content may be on relays that don't support full-text search</li>
        </ul>

        <h3>Slow Search Results</h3>
        <ul>
          <li>Check your internet connection</li>
          <li>Try using fewer search operators</li>
          <li>Some relays may have slower response times</li>
          <li>Consider using different search relays</li>
        </ul>

        <h3>Missing Expected Results</h3>
        <ul>
          <li>Content may be on relays you're not connected to</li>
          <li>Some users may have private or restricted accounts</li>
          <li>Very new content may not be indexed yet</li>
          <li>Try different search terms or operators</li>
        </ul>

        <h2>Search API</h2>
        <p>For developers building on Keythings:</p>

        <h3>REST Endpoints</h3>
        <ul>
          <li><code>GET /api/search/events</code> - Search for posts and events</li>
          <li><code>GET /api/search/profiles</code> - Search for user profiles</li>
          <li><code>GET /api/search/hashtags</code> - Get trending hashtags</li>
        </ul>

        <h3>Query Parameters</h3>
        <ul>
          <li><code>q</code> - Search query string</li>
          <li><code>tab</code> - Result type (posts, people, hashtags)</li>
          <li><code>limit</code> - Number of results to return</li>
          <li><code>cursor</code> - For pagination</li>
        </ul>

        <h2>Future Enhancements</h2>
        <p>Upcoming search features:</p>
        <ul>
          <li><strong>Semantic search</strong>: Understand meaning, not just keywords</li>
          <li><strong>Image search</strong>: Search by image content and metadata</li>
          <li><strong>Voice search</strong>: Search using voice commands</li>
          <li><strong>AI-powered recommendations</strong>: Discover content based on your interests</li>
        </ul>

        <blockquote>
          Search is the gateway to discovery on Nostr. Keythings's advanced search capabilities
          make it easy to find exactly what you're looking for in the vast decentralized network.
        </blockquote>

        <h2>Learn More</h2>
        <ul>
          <li><a href="/docs/nostr-basics" className="text-accent-gradient hover:underline">Nostr Basics</a></li>
          <li><a href="/docs/tutorials/search" className="text-accent-gradient hover:underline">Search Tutorial</a></li>
          <li><a href="/docs/api" className="text-accent-gradient hover:underline">API Documentation</a></li>
          <li><a href="https://github.com/nostr-protocol/nips/blob/master/50.md" className="text-accent-gradient hover:underline">NIP-50 Specification</a></li>
        </ul>
      </div>
    </div>
  )
}

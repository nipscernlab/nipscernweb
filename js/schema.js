const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://nipscern.com",
    "name": "NIPSCERN Lab",
    "description": "NIPSCERN Lab - A global resource for learning, research, and innovation, focusing on scalable architecture for hardware optimization.",
    "inLanguage": ["en", "pt", "fr", "no"],
    "potentialAction": {
        "@type": "SearchAction",
        "target": "https://nipscern.com/search?query={search_term}",
        "query-input": "required name=search_term"
    },
    "publisher": {
        "@type": "Organization",
        "name": "NIPSCERN Lab",
        "url": "https://nipscern.com",
        "logo": "https://nipscern.com/assets/icons/icon_home_psychology.svg",
        "sameAs": [
            // Add social links if needed, e.g., "https://twitter.com/nipscern"
        ]
    },
    "mainEntity": [
        {
            "@type": "CreativeWork",
            "name": "SAPHO",
            "url": "https://nipscern.com/projects/sapho"
        },
        {
            "@type": "CreativeWork",
            "name": "AURA",
            "url": "https://nipscern.com/projects/aura"
        },
        {
            "@type": "CreativeWork",
            "name": "ALICE",
            "url": "https://nipscern.com/projects/alice"
        },
        {
            "@type": "CreativeWork",
            "name": "Helvetia",
            "url": "https://nipscern.com/projects/helvetia"
        },
        {
            "@type": "CreativeWork",
            "name": "Infinity",
            "url": "https://nipscern.com/projects/infinity"
        },
        {
            "@type": "CreativeWork",
            "name": "CERN",
            "url": "https://nipscern.com/projects/cern"
        }
    ]
};

const script = document.createElement('script');
script.type = 'application/ld+json';
script.textContent = JSON.stringify(jsonLdData);
document.head.appendChild(script);

<p align="center">
  <img src="https://github.com/nipscernlab/nipscernweb/blob/main/assets/icons/nipscernweb.svg"
       alt="NIPSCERN Icon"
       width="160">
  <img src="https://github.com/nipscernlab/nipscernweb/blob/main/assets/icons/nipscernv2.svg"
       alt="NIPSCERN Icon"
       width="160">
</p>

# NIPSCERNWEB

**NIPSCERNWEB** is the official web repository of the **NIPSCERN Laboratory**, containing all assets and source files used to build and deliver **nipscern.com**.

This repository hosts the complete website stack, including:

- HTML, CSS, and JavaScript sources  
- Visual assets, icons, and branding materials  
- Documentation and tutorial content  
- Project pages, publications, and technical references  

The website is globally delivered via **Cloudflare’s distributed infrastructure**, ensuring high availability and low-latency access worldwide.  
Domain management and content delivery are fully handled through Cloudflare services.

NIPSCERNWEB serves as the primary platform for:

- Presenting laboratory projects and software ecosystems  
- Publishing technical documentation and tutorials  
- Disseminating scientific papers and research outcomes  
- Communicating advances and discoveries in **particle physics**, particularly those related to **CERN**

Our mission is **high-level scientific outreach**, providing accurate, accessible, and technically rigorous content on **particle physics**, experimental research, and new discoveries at CERN.

## Infrastructure

- The site is served via **GitHub Pages** behind **Cloudflare**.
- Heavy media (publication PDFs, videos, large images) lives in
  [nipscern-assets](https://github.com/nipscernlab/nipscern-assets) and is
  served from **cdn.nipscern.com**. Files above 2 MB are blocked by CI in
  this repository.
- The CGVWeb application is deployed from its own repository,
  [cgv-web](https://github.com/nipscernlab/cgv-web), and served at
  `nipscern.com/projects/cgvweb` through a Cloudflare Worker
  (see [workers/](workers/)).

## Contributing

Only NIPSCERN organization members have write access. External contributions
are welcome via pull request and are reviewed by the members before merging.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## We are hiring

NIPSCERN is looking for researchers in **logic, philosophy, software
engineering, engineering disciplines, programming and design**. Reach out
through [nipscern.com](https://nipscern.com).

## License

This repository is licensed under the **NIPSCERN License 1.0**
([LICENSE.md](LICENSE.md)): free to read, study, use and modify, including
inside companies; **commercial exploitation requires prior written
authorization** from the Laboratory. We are open to partnerships, talk to us.
Third-party materials (CERN media, publications owned by their authors) keep
their own terms, as indicated in the [site credits](https://nipscern.com/credits.html).

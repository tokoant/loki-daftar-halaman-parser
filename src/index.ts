import type { LinkDictionary } from './models/types/DaftarHalaman';
import { TARGETED_DAFTAR_HALAMAN_URL } from './models/constants';
import fs from 'fs';
import { stringify } from 'csv-stringify';
import { load } from 'cheerio';

import axios from 'axios';

const fetchHtml = async (url: string) => {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (e) {
    console.log(e);
    return null;
  }
}

const checkIfIsBrokenLink = async (url: string) => {
  const htmlStr = await fetchHtml(url);
  if (htmlStr === null){
    return true;
  }
  const $ = load(htmlStr.toString());
  const containers = $('div[data-unify^="GlobalError"]');
  if (!containers) return false;
  return true;
};

const createBrokenLinkCSV = async (linkDict: LinkDictionary) => {
  const filename = "daftar-halaman.csv";
  const writableStream = fs.createWriteStream(filename);

  const columns = [
    "Container",
    "Link",
    "Is Topic",
    "Is Broken",
  ];
  

  const stringifier = stringify({ header: true, columns: columns });

  for (const containerName in linkDict) {
    if (Object.prototype.hasOwnProperty.call(linkDict, containerName)) {
      const container = linkDict[containerName];
      if (!container){ continue; }
      for (let index = 0; index < container.length; index++) {
        const link = container[index];

        const colOne = containerName || 'Unnnamed / Empty String';
        const colThree = link?.isTopicUrl ? 'true' : 'false';
        const colFour = link?.isBroken ? 'true' : 'false';
        stringifier.write([ colOne, link?.url, colThree, colFour ]);
      }
    }
  }

  stringifier.pipe(writableStream);
}

const parseDaftarHalamanPages = async () => {
  const htmlStr = await fetchHtml(TARGETED_DAFTAR_HALAMAN_URL);
  const $ = load(htmlStr.toString());

  // step 1: get all containers, the container is a div mark by __typename=RechargeSlugSitemap attributes
  const containers = $('#content div[__typename^="RechargeSlugSitemap"]');
  
  // step 2: loop through the container
  const linkDict: LinkDictionary = {};
  for (let ci = 0; ci < containers.length; ci++) {
    const container = containers[ci];

    // step 3: get all anchor elements in the container
    const allAnchorEls = $(container).find('a');
    
    // step 4: loop through and process all anchor elements
    let containerName = '';

    for (const key in allAnchorEls) {
      if (Object.prototype.hasOwnProperty.call(allAnchorEls, key)) {

        const anchorIndex = Number(key);
        const anchorEl = $(allAnchorEls[anchorIndex]);

        // exclude first anchor for processing
        if (anchorIndex === 0 || Number.isNaN(anchorIndex)) {
          continue;
        }

        // setup dictionary with container name that contain in second anchor
        if (anchorIndex === 1){
          containerName = anchorEl.html() || '';
          linkDict[containerName] = [];
          console.log(`on container: ${containerName} (${allAnchorEls.length})`);
        }

        // get daftar-halaman url value href from the anchor
        const anchorHref = anchorEl.attr('href');
        if (anchorHref){
          const isBroken = await checkIfIsBrokenLink(anchorHref);
          console.log(`processing: ${containerName} - ${anchorHref}`);
          linkDict[containerName]?.push({ isTopicUrl: anchorIndex === 1, url: anchorHref, isBroken });
        }
      }
    }
  }

  createBrokenLinkCSV(linkDict);
}

parseDaftarHalamanPages();

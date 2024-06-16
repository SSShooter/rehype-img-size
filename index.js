import path from "path";
import { visit } from "unist-util-visit";
import sizeOf from "image-size";
import http from "http";
import https from "https";

export default setImageSize;

/**
 * Handles:
 * "//"
 * "http://"
 * "https://"
 * "ftp://"
 */
const absolutePathRegex = /^(?:[a-z]+:)?\/\//;

const getRemoteImage = (src) => {
  return new Promise((resolve, reject) => {
    const req = src.startsWith("https") ? https : http;
    req
      .get(src, (response) => {
        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};

function getImageSize(src, opts) {
  const dir = opts.dir;
  const useRemoteImage = opts.useRemoteImage === false ? false : true;
  if (absolutePathRegex.exec(src) && useRemoteImage) {
    return getRemoteImage(src)
      .then((buffer) => {
        return sizeOf(buffer);
      })
      .catch((error) => {
        console.error(`Error fetching remote image: ${error.message}`);
      });
  }
  // Treat `/` as a relative path, according to the server
  const shouldJoin = !path.isAbsolute(src) || src.startsWith("/");

  if (dir && shouldJoin) {
    src = path.join(dir, src);
  }
  return sizeOf(src);
}

function setImageSize(options) {
  const opts = options || {};
  return async function transformer(tree) {
    visit(tree, "element", async function visitor(node) {
      if (node.tagName === "img") {
        const src = node.properties.src;
        const dimensions = (await getImageSize(src, opts)) || {};
        node.properties.width = dimensions.width || 200;
        node.properties.height = dimensions.height || 200;
      }
    });
  };
}

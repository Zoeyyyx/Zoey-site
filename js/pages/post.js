import { getPublishedPostBySlug } from "../services/posts-service.js";
import { escapeHtml, formatDate, getSearchParam, renderRichText, setText } from "../lib/utils.js";

const titleNode = document.querySelector("#postTitle");
const summaryNode = document.querySelector("#postSummary");
const categoryNode = document.querySelector("#postCategory");
const dateNode = document.querySelector("#postDate");
const coverNode = document.querySelector("#postCover");
const bodyNode = document.querySelector("#postBody");

async function initPostPage() {
  const slug = getSearchParam("slug");

  if (!slug) {
    if (bodyNode) {
      bodyNode.innerHTML = '<p class="writing-empty">没有找到文章 slug。</p>';
    }
    return;
  }

  try {
    const post = await getPublishedPostBySlug(slug);
    document.title = `${post.title} | Zoey`;
    setText(titleNode, post.title);
    setText(summaryNode, post.summary);
    setText(categoryNode, post.category);
    setText(dateNode, formatDate(post.publish_date));

    if (coverNode) {
      coverNode.innerHTML = post.cover_image_url
        ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}">`
        : "";
      coverNode.hidden = !post.cover_image_url;
    }

    if (bodyNode) {
      bodyNode.innerHTML = renderRichText(post.content_html);
    }
  } catch (error) {
    if (bodyNode) {
      bodyNode.innerHTML = '<p class="writing-empty">文章暂时无法读取，可能尚未发布或 slug 不存在。</p>';
    }
  }
}

initPostPage();

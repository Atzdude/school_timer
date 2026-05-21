use tauri::WebviewWindow;

pub fn show_renderer_failure(window: &WebviewWindow, title: &str, detail: &str) {
    let escaped_title = html_escape(title);
    let escaped_detail = html_escape(detail);
    let html = format!(
        r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><title>timer</title><style>
            body {{ margin:0; min-height:100vh; display:grid; place-items:center;
                    font-family:Arial,sans-serif; background:#F0F6FE; color:#1B254B; }}
            main {{ max-width:720px; padding:32px; }}
            h1 {{ margin:0 0 12px; font-size:28px; }}
            p {{ line-height:1.5; }}
            code {{ background:#FFFFFF; border:1px solid #D8E2F0; border-radius:4px; padding:2px 5px; }}
        </style></head><body><main>
            <h1>The timer could not open</h1>
            <p><strong>{}:</strong> {}</p>
            <p>Restart the app. If this keeps happening, report it with the message above.</p>
        </main></body></html>"#,
        escaped_title, escaped_detail
    );
    let url = format!("data:text/html;charset=utf-8,{}", urlencoding_encode(&html));
    let js = format!("window.location.replace('{}')", url.replace('\'', "\\'"));
    if let Err(e) = window.eval(&js) {
        eprintln!("Failed to show error overlay: {}", e);
    }
}

pub fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&#39;")
}

pub fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_escape_replaces_dangerous_chars() {
        assert_eq!(html_escape("<script>&\"'"), "&lt;script&gt;&amp;&quot;&#39;");
    }

    #[test]
    fn urlencoding_preserves_unreserved_chars() {
        assert_eq!(urlencoding_encode("abc-_.~"), "abc-_.~");
    }

    #[test]
    fn urlencoding_encodes_space_and_bracket() {
        assert_eq!(urlencoding_encode(" <"), "%20%3C");
    }
}

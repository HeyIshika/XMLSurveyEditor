// Updated editor-component.ts including full app.component.ts logic

import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

let mammothLib: any;

async function getMammoth() {
  if (!mammothLib) {
    const module = await import('mammoth');
    mammothLib = module.default || module; // <— FIX for GitHub Pages
  }
  return mammothLib;
}

@Component({
  selector: 'editor-component',
  templateUrl: './editor-component.html',
  standalone: true,
  imports: [FormsModule]
})
export class EditorComponent {

  docText: string = '';
  xmlText: string = '';

  ngOnInit() {}

  async uploadDoc(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Dynamically import mammoth to reduce initial bundle size
    const mammoth = await getMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    this.docText = result.value.trim();
    this.updateXML();
  }

  uploadXML(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.xmlText = this.formatXML(e.target.result);
      this.updateDocument();
    };
    reader.readAsText(file);
  }

  updateXML() {
    if (!this.docText) {
      this.xmlText = '';
      return;
    }

    const lines = this.docText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    let xmlParts: string[] = [];
    let qNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const singleMatch = line.match(/^\[single select\]\s*(.*)/i);
      const multiMatch = line.match(/^\[multi-select\]\s*(.*)/i);

      if (singleMatch || multiMatch) {
        const isRadio = !!singleMatch;
        const tag = isRadio ? 'radio' : 'checkbox';
        let title = (singleMatch ? singleMatch[1] : multiMatch![1]).trim();

        xmlParts.push(`<${tag} label="Q${qNumber}">`);
        xmlParts.push(`  <title>${this.escapeXml(title)}</title>`);
        xmlParts.push(`  <comment>${isRadio ? 'Select one' : 'Select all that apply'}</comment>`);

        let r = 1;
        i++;

        for (; i < lines.length; i++) {
          const optLine = lines[i];
          if (/^\[/.test(optLine)) {
            i--;
            break;
          }

          let option = optLine;
          let attributes: string[] = [];

          if (/\[open-end\]/i.test(option)) {
            attributes.push('open="1"');
            option = option.replace(/\[open-end\]/i, '').trim();
          }

          if (/\[exclusive\]/i.test(option)) {
            attributes.push('exclusive="1"');
            option = option.replace(/\[exclusive\]/i, '').trim();
          }

          const rowLabel = `r${r}`;
          const attrStr = attributes.length ? ' ' + attributes.join(' ') : '';
          xmlParts.push(`  <row label="${rowLabel}"${attrStr}>${this.escapeXml(option)}</row>`);

          r++;
        }

        xmlParts.push(`</${tag}>`);
        xmlParts.push(`<suspend/>`);
        xmlParts.push(`<term label="termQ${qNumber}" cond="not (Q${qNumber}.rX)">Term:Q${qNumber}</term>`);
        xmlParts.push('');

        qNumber++;
        continue;
      }

      xmlParts.push(`<instruction>${this.escapeXml(line)}</instruction>`);
    }

    this.xmlText = this.formatXML(xmlParts.join('\n'));
  }

  updateDocument() {
    if (!this.xmlText || !this.xmlText.trim()) {
      this.docText = '';
      return;
    }
  
    try {
      const trimmedXml = this.xmlText.trim();
      if (!trimmedXml) {
        this.docText = '';
        return;
      }
      
      const parser = new DOMParser();
      
      // Wrap XML in a root element to handle fragments (multiple top-level elements)
      // This is necessary because updateXML() generates XML without a root element
      const xmlToParse = `<root>${trimmedXml}</root>`;
      const xml = parser.parseFromString(xmlToParse, 'text/xml');
      
      // Check for parsing errors
      const parserError = xml.querySelector('parsererror');
      if (parserError) {
        console.warn('XML parsing error:', parserError.textContent);
        return;
      }
      
      // Get the root wrapper element and its children
      const root = xml.documentElement;
      if (!root) {
        return;
      }
  
      // Get all direct child elements (these are the actual survey elements)
      const elements = Array.from(root.children) as Element[];
  
      const outLines: string[] = [];
  
      elements.forEach(el => {
        const tag = el.tagName.toLowerCase();
  
        // ---------------------------
        // RADIO / CHECKBOX BLOCKS
        // ---------------------------
        if (tag === 'radio' || tag === 'checkbox') {
          const isRadio = tag === 'radio';
          const title = el.getElementsByTagName('title')[0]?.textContent?.trim() || '';

          // Title line - simple format matching updateXML()
          outLines.push(`[${isRadio ? 'single select' : 'multi-select'}] ${title}`);

          // ROWS - extract rows with their attributes
          const rows = Array.from(el.getElementsByTagName('row'));

          rows.forEach(r => {
            let rowText = r.textContent?.trim() || '';
            const attrs: string[] = [];

            // open-end
            if (r.getAttribute('open') === '1') attrs.push('[open-end]');

            // exclusive
            if (r.getAttribute('exclusive') === '1') attrs.push('[exclusive]');

            // Write row with attributes
            outLines.push(rowText + (attrs.length ? ' ' + attrs.join(' ') : ''));
          });

          outLines.push(''); // spacing after block
        }
  
        // ---------------------------
        // SUSPEND - skip in document text (XML-only element)
        // ---------------------------
        else if (tag === 'suspend') {
          // Skip - not part of document text format
        }

        // ---------------------------
        // TERM - skip in document text (XML-only element)
        // ---------------------------
        else if (tag === 'term') {
          // Skip - not part of document text format
        }

        // ---------------------------
        // INSTRUCTION
        // ---------------------------
        else if (tag === 'instruction') {
          const text = el.textContent?.trim() || '';
          if (text) {
            outLines.push(text);
          }
        }
  
        // ---------------------------
        // FALLBACK
        // ---------------------------
        else {
          const text = el.textContent?.trim() || '';
          outLines.push(`<${tag}>${text}</${tag}>`);
          outLines.push('');
        }
      });
  
      // Join lines and clean up extra blank lines
      this.docText = outLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
        .trim();
    } catch (e) {
      console.warn('XML parse error – skipping document update.', e);
    }
  }
  

  escapeXml(str: string) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  formatXML(xml: string): string {
    try {
      const PADDING = '  ';
      const reg = /(>)(<)(\/*)/g;
      xml = xml.replace(reg, '$1\n$2$3');
      let formatted = '';
      let pad = 0;

      xml.split(/\n/).forEach(node => {
        let indent = 0;
        if (node.match(/^<\//)) pad--;
        formatted += PADDING.repeat(pad) + node + '\n';
        if (node.match(/^<[^!?][^>]*[^\/]>/)) indent = 1;
        pad += indent;
      });
      return formatted.trim();
    } catch {
      return xml;
    }
  }

  downloadDoc() {
    const blob = new Blob([this.docText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadXML() {
    const blob = new Blob([this.xmlText], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'survey.xml';
    a.click();
    URL.revokeObjectURL(url);
  }
}
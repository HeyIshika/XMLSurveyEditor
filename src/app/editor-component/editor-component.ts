import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'editor-component',
  templateUrl: './editor-component.html',
  standalone: true,
  imports: [FormsModule]
})
export class EditorComponent {

  docText: string = `Q1. What is Angular?
Q2. What is Dependency Injection?`;

  xmlText: string = '';

  ngOnInit() {
    this.updateXML();
  }

  // Convert Document → XML
  updateXML() {
    const lines = this.docText.split('\n').filter(q => q.trim());

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Questions>\n`;

    lines.forEach((line, index) => {
      const clean = line.replace(/^Q?\d+[\.\)]?\s*/i, '').trim();
      xml += `  <Question id="${index + 1}">${clean}</Question>\n`;
    });

    xml += `</Questions>`;

    this.xmlText = xml;
  }

  // Convert XML → Document
  updateDocument() {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(this.xmlText, 'text/xml');

      const questions = Array.from(xmlDoc.getElementsByTagName('Question'));
      if (!questions.length) return;

      let doc = '';
      questions.forEach((q, index) => {
        doc += `Q${index + 1}. ${q.textContent?.trim()}\n`;
      });

      this.docText = doc.trim();
    } catch {
      // ignore XML parse errors while typing
    }
  }

  // ----------------------
  // FILE HANDLING METHODS
  // ----------------------

  uploadDoc(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.docText = e.target.result;
      this.updateXML();
    };

    reader.readAsText(file);
  }

  uploadXML(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.xmlText = e.target.result;
      this.updateDocument();
    };

    reader.readAsText(file);
  }

  downloadDoc() {
    const blob = new Blob([this.docText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.txt';
    a.click();

    window.URL.revokeObjectURL(url);
  }

  downloadXML() {
    const blob = new Blob([this.xmlText], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.xml';
    a.click();

    window.URL.revokeObjectURL(url);
  }
}

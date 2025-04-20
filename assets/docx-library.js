(function (global) {
    const core = global.docx?.Document ? global.docx : global.docx?.default;

    if (!core || !core.Document) {
        console.error("❌ DOCX library not loaded properly. Check if the CDN script loaded before this file.");
        return;
    }

    const { Document, Paragraph, TextRun, Packer, HeadingLevel } = core;

    async function exportToDocx(text) {
        try {
            const paragraphs = [];
            const lines = text.split('\n');

            for (const line of lines) {
                // After trimming line:
                const trimmedLine = line.trim();

                if (!trimmedLine) {
                    // Add an invisible line that Blackboard won't strip
                    paragraphs.push(new Paragraph({
                        children: [new TextRun('\u200B')],  // Zero-width space
                        spacing: { after: 100 }
                    }));
                    continue;
                }


                if (trimmedLine.startsWith('===')) {
                    paragraphs.push(new Paragraph({
                        text: trimmedLine.replace(/=/g, '').trim(),
                        heading: HeadingLevel.HEADING_1,
                        spacing: { after: 400 }
                    }));
                } else if (trimmedLine.match(/^[A-Z].*\(\d+%\)/) || trimmedLine.includes(':')) {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: trimmedLine, bold: true, size: 24 })],
                        spacing: { after: 200 }
                    }));
                } else if (trimmedLine.startsWith('- ')) {
                    paragraphs.push(new Paragraph({
                        //children: [new TextRun({ text: trimmedLine, size: 22 })],
                        children: [new TextRun({ text: '• ' + trimmedLine.slice(2), size: 22 })],
                        spacing: { after: 100 },
                        indent: { left: 400 }
                    }));
                } else {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: trimmedLine, size: 22 })],
                        spacing: { after: 100 }
                    }));
                }
            }

            const doc = new Document({
                styles: {
                    paragraphStyles: [{
                        id: "normal",
                        name: "Normal",
                        run: { size: 24, font: "Calibri" },
                        paragraph: { spacing: { line: 276 } }
                    }]
                },
                sections: [{ children: paragraphs }]
            });

            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'feedback.docx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('❌ DOCX Export Error:', error);
            throw error;
        }
    }

    function getBlackboardText(text) {
        return text
            .replace(/●/g, '-')
            .replace(/\t/g, '    ')
            .replace(/\u200B/g, '');
    }

    global.docxUtils = {
        exportToDocx,
        getBlackboardText
    };

})(window);

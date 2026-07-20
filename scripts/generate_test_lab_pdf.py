from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "test-laboratuvar-sonuclari-turkce.pdf"

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

PAGE_WIDTH, PAGE_HEIGHT = A4
NAVY = colors.HexColor("#17324D")
TEAL = colors.HexColor("#087E8B")
PALE_TEAL = colors.HexColor("#E7F5F5")
PALE_BLUE = colors.HexColor("#EEF4FA")
GRID = colors.HexColor("#CBD5E1")
TEXT = colors.HexColor("#182230")
MUTED = colors.HexColor("#5E6B78")
LOW = colors.HexColor("#B54708")
HIGH = colors.HexColor("#B42318")
NORMAL = colors.HexColor("#027A48")
UNCERTAIN = colors.HexColor("#6941C6")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="TitleTR",
        fontName="Arial-Bold",
        fontSize=17,
        leading=21,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=3 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="SubtitleTR",
        fontName="Arial",
        fontSize=8.5,
        leading=11,
        textColor=MUTED,
        spaceAfter=3 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionTR",
        fontName="Arial-Bold",
        fontSize=10,
        leading=12,
        textColor=NAVY,
        spaceBefore=2.5 * mm,
        spaceAfter=1.4 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="CellTR",
        fontName="Arial",
        fontSize=7.5,
        leading=9,
        textColor=TEXT,
    )
)
styles.add(
    ParagraphStyle(
        name="CellBoldTR",
        fontName="Arial-Bold",
        fontSize=7.5,
        leading=9,
        textColor=TEXT,
    )
)
styles.add(
    ParagraphStyle(
        name="HeaderCellTR",
        fontName="Arial-Bold",
        fontSize=7.2,
        leading=8.5,
        textColor=colors.white,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="NoticeTR",
        fontName="Arial-Bold",
        fontSize=8,
        leading=10.5,
        textColor=HIGH,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="FootnoteTR",
        fontName="Arial",
        fontSize=7.2,
        leading=9.5,
        textColor=MUTED,
    )
)


def p(text: str, style: str = "CellTR") -> Paragraph:
    return Paragraph(text, styles[style])


def draw_page(canvas, document):
    canvas.saveState()
    canvas.setFont("Arial-Bold", 34)
    canvas.setFillColor(colors.Color(0.72, 0.78, 0.84, alpha=0.12))
    canvas.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
    canvas.rotate(33)
    canvas.drawCentredString(0, 0, "KURGUSAL TEST BELGESİ")
    canvas.rotate(-33)
    canvas.translate(-PAGE_WIDTH / 2, -PAGE_HEIGHT / 2)

    canvas.setStrokeColor(GRID)
    canvas.line(16 * mm, 12 * mm, PAGE_WIDTH - 16 * mm, 12 * mm)
    canvas.setFont("Arial", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 8 * mm, "Anne+ PDF okuma özelliği için sentetik test verisi")
    canvas.drawRightString(
        PAGE_WIDTH - 16 * mm,
        8 * mm,
        f"Sayfa {document.page}",
    )
    canvas.restoreState()


def info_table():
    data = [
        [p("Hasta Adı Soyadı", "CellBoldTR"), p("Şule Işık Öztürk"), p("Hasta No", "CellBoldTR"), p("TST-2026-0717")],
        [p("T.C. Kimlik No", "CellBoldTR"), p("12345678901"), p("Doğum Tarihi", "CellBoldTR"), p("14.03.1992")],
        [p("Cinsiyet", "CellBoldTR"), p("Kadın"), p("Rapor Tarihi", "CellBoldTR"), p("17.07.2026 10:30")],
        [p("Adres", "CellBoldTR"), p("Çiçek Mah. Güneş Sok. No: 7, Üsküdar / İstanbul"), p("Numune", "CellBoldTR"), p("Serum, plazma ve tam kan")],
        [p("İsteyen Hekim", "CellBoldTR"), p("Dr. Örnek Kullanıcı"), p("Laboratuvar", "CellBoldTR"), p("Türkçe Karakter Test Merkezi")],
    ]
    table = Table(data, colWidths=[30 * mm, 65 * mm, 29 * mm, 55 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), PALE_BLUE),
                ("BACKGROUND", (2, 0), (2, -1), PALE_BLUE),
                ("GRID", (0, 0), (-1, -1), 0.4, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def result_table(rows):
    header = [
        p("Tetkik", "HeaderCellTR"),
        p("Sonuç", "HeaderCellTR"),
        p("Birim", "HeaderCellTR"),
        p("Referans Aralığı", "HeaderCellTR"),
        p("Durum", "HeaderCellTR"),
    ]
    data = [header]
    status_rows = []
    for index, (test, result, unit, reference, status) in enumerate(rows, start=1):
        data.append([p(test), p(result, "CellBoldTR"), p(unit), p(reference), p(status, "CellBoldTR")])
        status_rows.append((index, status))

    table = Table(
        data,
        colWidths=[51 * mm, 22 * mm, 25 * mm, 58 * mm, 23 * mm],
        repeatRows=1,
    )
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for row_index, status in status_rows:
        if row_index % 2 == 0:
            commands.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#F8FAFC")))
        status_color = NORMAL
        if "Düşük" in status:
            status_color = LOW
        elif "Yüksek" in status or "Pozitif" in status or "Anormal" in status:
            status_color = HIGH
        elif "Belirsiz" in status:
            status_color = UNCERTAIN
        commands.append(("TEXTCOLOR", (4, row_index), (4, row_index), status_color))
    table.setStyle(TableStyle(commands))
    return table


sections = [
    (
        "Hemogram",
        [
            ("Hemoglobin (HGB)", "9,8", "g/dL", "12,0 – 16,0", "Düşük (L)"),
            ("Hematokrit (HCT)", "31,0", "%", "36,0 – 46,0", "Düşük (L)"),
            ("Lökosit (WBC)", "7,4", "10³/µL", "4,0 – 10,0", "Normal"),
            ("Trombosit (PLT)", "480", "10³/µL", "150 – 400", "Yüksek (H)"),
            ("Nötrofil", "4,2", "10³/µL", "1,8 – 7,7", "Normal"),
        ],
    ),
    (
        "Demir ve Vitaminler",
        [
            ("Ferritin", "7", "ng/mL", "15 – 150", "Düşük (L)"),
            ("Serum Demiri", "38", "µg/dL", "50 – 170", "Düşük (L)"),
            ("Vitamin B12", "410", "pg/mL", "200 – 900", "Normal"),
            ("Folat", "18,2", "ng/mL", "3,1 – 17,5", "Yüksek (H)"),
            ("25-OH Vitamin D", "14", "ng/mL", "30 – 100", "Düşük (L)"),
        ],
    ),
    (
        "Glukoz ve Lipit Profili",
        [
            ("Açlık Glukozu", "132", "mg/dL", "70 – 99", "Yüksek (H)"),
            ("HbA1c", "5,4", "%", "4,0 – 5,6", "Normal"),
            ("İnsülin", "8,6", "µIU/mL", "2,6 – 24,9", "Normal"),
            ("Total Kolesterol", "238", "mg/dL", "< 200", "Yüksek (H)"),
            ("LDL Kolesterol", "164", "mg/dL", "< 100", "Yüksek (H)"),
            ("HDL Kolesterol", "36", "mg/dL", "> 50", "Düşük (L)"),
            ("Trigliserit", "220", "mg/dL", "< 150", "Yüksek (H)"),
        ],
    ),
    (
        "Tiroit ve Enflamasyon",
        [
            ("TSH", "6,20", "µIU/mL", "0,27 – 4,20", "Yüksek (H)"),
            ("Serbest T4", "0,72", "ng/dL", "0,93 – 1,70", "Düşük (L)"),
            ("Serbest T3", "3,10", "pg/mL", "2,0 – 4,4", "Normal"),
            ("CRP", "18", "mg/L", "0 – 5", "Yüksek (H)"),
        ],
    ),
    (
        "Karaciğer, Böbrek ve Elektrolitler",
        [
            ("ALT", "22", "U/L", "0 – 35", "Normal"),
            ("AST", "19", "U/L", "0 – 35", "Normal"),
            ("Kreatinin", "0,72", "mg/dL", "0,50 – 0,90", "Normal"),
            ("eGFR", "112", "mL/dk/1,73 m²", "> 90", "Normal"),
            ("Sodyum", "139", "mmol/L", "136 – 145", "Normal"),
            ("Potasyum", "3,2", "mmol/L", "3,5 – 5,1", "Düşük (L)"),
        ],
    ),
    (
        "Gebelik Hormonu",
        [
            ("β-hCG (Kantitatif)", "22", "mIU/mL", "< 5 negatif; 5 – 25 belirsiz; > 25 pozitif", "Belirsiz / gri bölge"),
        ],
    ),
    (
        "Tam İdrar İncelemesi",
        [
            ("Protein", "Negatif", "—", "Negatif", "Normal"),
            ("Glukoz", "++", "—", "Negatif", "Anormal"),
            ("Nitrit", "Pozitif", "—", "Negatif", "Pozitif / anormal"),
            ("Lökosit", "18", "HPF", "0 – 5", "Yüksek (H)"),
            ("Eritrosit", "2", "HPF", "0 – 3", "Normal"),
        ],
    ),
]


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=17 * mm,
        title="Türkçe Laboratuvar Sonuçları – Kurgusal Test Belgesi",
        author="Anne+ Test Verisi",
        subject="PDF okuma ve laboratuvar sonucu açıklama özelliği testi",
    )

    story = [
        Paragraph("TÜRKÇE LABORATUVAR SONUÇ RAPORU", styles["TitleTR"]),
        Paragraph(
            "PDF okuma, Türkçe karakter, kişisel alan maskeleme ve referans aralığı yorumlama testi",
            styles["SubtitleTR"],
        ),
        Table(
            [[Paragraph("DİKKAT: TAMAMEN KURGUSAL TEST BELGESİ — TIBBİ KULLANIMA UYGUN DEĞİLDİR", styles["NoticeTR"])]],
            colWidths=[179 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3F2")),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#FDA29B")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            ),
        ),
        Spacer(1, 3 * mm),
        info_table(),
        Spacer(1, 2 * mm),
    ]

    for section_name, rows in sections:
        story.append(
            KeepTogether(
                [
                    Paragraph(section_name, styles["SectionTR"]),
                    result_table(rows),
                ]
            )
        )

    story.extend(
        [
            Spacer(1, 3 * mm),
            Table(
                [
                    [
                        p(
                            "Açıklama: Referans aralıkları, yalnızca yazılım testi amacıyla hazırlanmış tipik örneklerdir. "
                            "Laboratuvara, ölçüm yöntemine, yaşa ve gebelik haftasına göre değişebilir. Bu rapordaki kişi, "
                            "kurum ve sonuçlar gerçek değildir; tanı, tedavi veya sağlık tavsiyesi amacı taşımaz.",
                            "FootnoteTR",
                        )
                    ]
                ],
                colWidths=[179 * mm],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), PALE_TEAL),
                        ("BOX", (0, 0), (-1, -1), 0.5, TEAL),
                        ("LEFTPADDING", (0, 0), (-1, -1), 7),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                        ("TOPPADDING", (0, 0), (-1, -1), 7),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ]
                ),
            ),
        ]
    )
    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()

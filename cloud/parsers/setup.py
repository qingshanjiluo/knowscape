from setuptools import setup, find_packages

setup(
    name="knowscape-parser",
    version="0.1.0",
    description="KnowScape document parsing engine (cloud edition)",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "ebooklib>=0.18",
        "beautifulsoup4>=4.12",
        "lxml>=5.0",
        "PyMuPDF>=1.24",
        "pytesseract>=0.3",
        "Pillow>=10.0",
        "python-docx>=1.1",
        "requests>=2.31",
    ],
    extras_require={
        "dev": ["pytest", "pytest-cov"],
    },
)

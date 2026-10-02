import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "fetcher"))
import fetch_data as f


class T(unittest.TestCase):
    def test_vi_parse(self):
        txt = "データ日付,終値,始値,高値,安値\n2026/09/30,\"21.5\",22,23,21\n2026/10/01,19.25,20,21,19\n※注記\n"
        self.assertEqual(f.parse_nikkei_vi(txt), [
            {"date": "2026-09-30", "close": 21.5}, {"date": "2026-10-01", "close": 19.25}])

    def test_cnn_parse(self):
        p = {"fear_and_greed_historical": {"data": [{"x": 1759276800000, "y": 61.234, "rating": "greed"}]}}
        self.assertEqual(f.parse_cnn(p)[0]["score"], 61.2)

    def test_sample(self):
        vi, fg = f.sample_data(60)
        self.assertEqual(len(vi), len(fg))
        self.assertTrue(all(0 <= r["score"] <= 100 for r in fg))


if __name__ == "__main__":
    unittest.main()

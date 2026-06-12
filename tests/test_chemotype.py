import pytest
from api.chemotype import classify_chemotype

def test_type_i_high_thca():
    assert classify_chemotype(22.0, 0.1) == "Type I"

def test_type_i_zero_cbd():
    assert classify_chemotype(18.0, 0.0) == "Type I"

def test_type_ii_balanced():
    assert classify_chemotype(10.0, 8.0) == "Type II"

def test_type_iii_cbd_dominant():
    assert classify_chemotype(0.3, 15.0) == "Type III"

def test_type_iv_both_low():
    assert classify_chemotype(0.5, 0.5) == "Type IV"

def test_unclassified_none_thca():
    assert classify_chemotype(None, 10.0) == "Unclassified"

def test_unclassified_none_cbd():
    assert classify_chemotype(10.0, None) == "Unclassified"

def test_unclassified_both_none():
    assert classify_chemotype(None, None) == "Unclassified"

def test_type_i_boundary():
    assert classify_chemotype(10.0, 1.9) == "Type I"

def test_type_ii_boundary():
    assert classify_chemotype(5.0, 2.0) == "Type II"

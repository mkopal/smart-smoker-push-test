"""Shared catalog validation extracted from the isolated Smart Smoker experiment."""
import re


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate catalog key')
        result[key] = value
    return result


def messages(catalog, prefix=''):
    if not isinstance(catalog, dict) or not catalog:
        raise ValueError('Catalog must contain nested messages')
    result = {}
    for key, value in catalog.items():
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', key):
            raise ValueError('Invalid catalog key')
        name = prefix + key
        if isinstance(value, str):
            if not value or re.search(r'[{}]', re.sub(r'{{\w+}}', '', value)):
                raise ValueError('Malformed message interpolation')
            result[name] = set(re.findall(r'{{(\w+)}}', value))
        elif isinstance(value, dict) and 'other' in value:
            if not set(value) <= {'zero', 'one', 'two', 'few', 'many', 'other'}:
                raise ValueError('Invalid plural category')
            branches = messages(value)
            if any(args != branches['other'] for args in branches.values()) or 'count' not in branches['other']:
                raise ValueError('Incompatible plural arguments')
            result[name] = branches['other']
        else:
            result.update(messages(value, name + '.'))
    return result

/* tslint:disable */
/* eslint-disable */
/**
 * HashiCorp Vault API
 * HTTP API that gives you full access to Vault. All API routes are prefixed with `/v1/`.
 *
 * The version of the OpenAPI document: 1.21.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
/**
 * Check if a given object implements the PkiGenerateRootResponse interface.
 */
export function instanceOfPkiGenerateRootResponse(value) {
    return true;
}
export function PkiGenerateRootResponseFromJSON(json) {
    return PkiGenerateRootResponseFromJSONTyped(json, false);
}
export function PkiGenerateRootResponseFromJSONTyped(json, ignoreDiscriminator) {
    if (json == null) {
        return json;
    }
    return {
        'certificate': json['certificate'] == null ? undefined : json['certificate'],
        'expiration': json['expiration'] == null ? undefined : json['expiration'],
        'issuerId': json['issuer_id'] == null ? undefined : json['issuer_id'],
        'issuerName': json['issuer_name'] == null ? undefined : json['issuer_name'],
        'issuingCa': json['issuing_ca'] == null ? undefined : json['issuing_ca'],
        'keyId': json['key_id'] == null ? undefined : json['key_id'],
        'keyName': json['key_name'] == null ? undefined : json['key_name'],
        'privateKey': json['private_key'] == null ? undefined : json['private_key'],
        'serialNumber': json['serial_number'] == null ? undefined : json['serial_number'],
    };
}
export function PkiGenerateRootResponseToJSON(json) {
    return PkiGenerateRootResponseToJSONTyped(json, false);
}
export function PkiGenerateRootResponseToJSONTyped(value, ignoreDiscriminator = false) {
    if (value == null) {
        return value;
    }
    return {
        'certificate': value['certificate'],
        'expiration': value['expiration'],
        'issuer_id': value['issuerId'],
        'issuer_name': value['issuerName'],
        'issuing_ca': value['issuingCa'],
        'key_id': value['keyId'],
        'key_name': value['keyName'],
        'private_key': value['privateKey'],
        'serial_number': value['serialNumber'],
    };
}
